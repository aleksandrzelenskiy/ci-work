// src/app/api/org/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import Organization from '@/app/models/OrganizationModel';
import Membership from '@/app/models/MembershipModel';
import Subscription from '@/app/models/SubscriptionModel';
import { slugify } from '@/app/utils/slugify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Server error';
}

/** Плоский DTO для ответа */
type OrganizationDTO = { _id: string; name: string; orgSlug: string };

type GetOrganizationsResponse = { orgs: OrganizationDTO[] } | { error: string };
type CreateOrgBody = { name: string; orgSlug?: string; slug?: string };
type CreateOrgResponse = { ok: true; org: OrganizationDTO } | { error: string };

// GET /api/org — организации текущего пользователя
export async function GET(): Promise<NextResponse<GetOrganizationsResponse>> {
    try {
        await dbConnect();
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) {
            return NextResponse.json({ error: 'Auth required' }, { status: 401 });
        }

        const memberships = await Membership.find({ userEmail: email }).lean();
        const orgIds = memberships.map((m) => m.orgId);

        const organizationsRaw = await Organization.find({ _id: { $in: orgIds } }).lean();
        const organizations: OrganizationDTO[] = organizationsRaw.map((o) => ({
            _id: String(o._id),
            name: o.name,
            orgSlug: o.orgSlug, // ← берём из модели orgSlug
        }));

        return NextResponse.json({ orgs: organizations });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

// POST /api/org — создать организацию (поддерживает body.orgSlug и body.slug)
export async function POST(request: NextRequest): Promise<NextResponse<CreateOrgResponse>> {
    try {
        await dbConnect();
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        const ownerName = user?.fullName || user?.username || 'Owner';
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const body = (await request.json()) as CreateOrgBody;
        const orgName = body?.name;
        if (!orgName || orgName.trim().length < 2) {
            return NextResponse.json({ error: 'Укажите корректное название' }, { status: 400 });
        }

        // Приоритет: явный orgSlug (или legacy `slug`) → slugify(name)
        const provided = (body.orgSlug ?? body.slug ?? '').trim().toLowerCase();
        const candidateRaw = provided || slugify(orgName) || slugify(`org-${Date.now()}`);

        // нормализуем: [a-z0-9-], без крайних дефисов, без повторов
        const base = candidateRaw
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/--+/g, '-')
            .replace(/^-+|-+$/g, '');

        if (base.length < 3) {
            return NextResponse.json(
                { error: 'Некорректный orgSlug (минимум 3 символа, латиница/цифры/дефис)' },
                { status: 400 }
            );
        }

        // проверяем уникальность orgSlug
        let orgSlug = base;
        let i = 2;
        // eslint-disable-next-line no-await-in-loop
        while (await Organization.findOne({ orgSlug }).lean()) {
            // если пользователь явно передал slug/orgSlug — сразу сообщим о конфликте
            if (provided) {
                return NextResponse.json({ error: `orgSlug "${provided}" уже занят` }, { status: 409 });
            }
            orgSlug = `${base}-${i++}`;
        }

        const created = await Organization.create({
            name: orgName.trim(),
            orgSlug,
            ownerEmail: email,
            createdByEmail: email,
        });

        await Membership.create({
            orgId: created._id,
            userEmail: email,
            userName: ownerName,
            role: 'owner',
            status: 'active',
        });

        await Subscription.create({
            orgId: created._id,
            plan: 'free',
            status: 'inactive', // админ активирует вручную после оплаты
            seats: 10,
            projectsLimit: 10,
            note: 'Создано автоматически',
        });

        const org: OrganizationDTO = {
            _id: String(created._id),
            name: created.name,
            orgSlug: created.orgSlug,
        };

        return NextResponse.json({ ok: true, org });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}
