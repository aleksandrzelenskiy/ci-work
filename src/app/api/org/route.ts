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

/** Плоский DTO для организации */
type OrganizationDTO = { _id: string; name: string; slug: string };

type GetOrganizationsResponse = { orgs: OrganizationDTO[] } | { error: string };
type CreateOrgBody = { name: string; slug?: string };
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
            slug: o.slug,
        }));

        // ключ ответа сохраняем совместимым: { orgs: [...] }
        return NextResponse.json({ ['orgs']: organizations });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

// POST /api/org — создать организацию (можно передать свой slug)
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

        // 1) Если пришёл кастомный slug — валидируем и используем
        // 2) Иначе генерируем из name, а если занят — добавляем суффикс -2, -3, ...
        const rawCandidate = body.slug?.trim().toLowerCase() || slugify(orgName);
        let base = rawCandidate || slugify(`org-${Date.now()}`);
        // Разрешаем только [a-z0-9-], длина >= 3
        base = base
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/--+/g, '-')
            .replace(/^-+|-+$/g, '');
        if (base.length < 3) {
            return NextResponse.json({ error: 'Некорректный slug (минимум 3 символа, латиница/цифры/дефис)' }, { status: 400 });
        }

        let slug = base;
        let i = 2;
        // проверяем уникальность slug; если пользователь задал конкретный и он занят — шлём 409
        while (await Organization.findOne({ slug }).lean()) {
            if (body.slug) {
                return NextResponse.json({ error: `Slug "${body.slug}" уже занят` }, { status: 409 });
            }
            slug = `${base}-${i++}`;
        }

        const created = await Organization.create({
            name: orgName.trim(),
            slug,
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
            slug: created.slug,
        };

        return NextResponse.json({ ok: true, org });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}
