//app/api/tasks/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import ProjectModel from '@/app/models/ProjectModel';
import mongoose from 'mongoose';
import { GetUserContext } from '@/server-actions/user-context';

interface Location {
  coordinates: [number, number];
}

export async function GET() {
  try {
    await dbConnect();
    console.log('Connected to MongoDB');
  } catch (error: unknown) {
    console.error('Failed to connect to MongoDB:', error);
    return NextResponse.json(
      { error: 'Failed to connect to database' },
      { status: 500 }
    );
  }

  try {
    const userContext = await GetUserContext();

    if (!userContext.success || !userContext.data) {
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    const { user, effectiveOrgRole, isSuperAdmin, activeOrgId } =
      userContext.data;
    const clerkUserId = user.clerkUserId;
    const userEmail = user.email?.toLowerCase();

    const matchStage: Record<string, unknown> = {};

    if (isSuperAdmin) {
      // полный доступ, без ограничений
    } else if (effectiveOrgRole === 'executor') {
      matchStage.executorId = clerkUserId;
    } else {
      if (!activeOrgId || !effectiveOrgRole) {
        return NextResponse.json({ tasks: [] });
      }

      let orgObjectId: mongoose.Types.ObjectId;
      try {
        orgObjectId = new mongoose.Types.ObjectId(activeOrgId);
      } catch (error) {
        console.error('Invalid activeOrgId provided', error);
        return NextResponse.json({ tasks: [] });
      }

      matchStage.orgId = orgObjectId;

      switch (effectiveOrgRole) {
        case 'owner':
        case 'org_admin':
          break;
        case 'manager': {
          if (!userEmail) {
            return NextResponse.json({ tasks: [] });
          }

          const projectDocs = await ProjectModel.find({
            orgId: orgObjectId,
            managers: userEmail,
          })
            .select('_id')
            .lean();

          if (projectDocs.length === 0) {
            return NextResponse.json({ tasks: [] });
          }

          matchStage.projectId = {
            $in: projectDocs.map((p) => p._id),
          };
          break;
        }
        default:
          return NextResponse.json({ tasks: [] });
      }
    }

    const tasks = await TaskModel.aggregate([
      {
        $match: matchStage,
      },
      {
        $addFields: {
          bsNumbers: {
            $split: ['$bsNumber', '-'],
          },
        },
      },
      {
        $lookup: {
          from: 'objects-t2-ir',
          let: { bsNumbers: '$bsNumbers' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$name', '$$bsNumbers'],
                },
              },
            },
          ],
          as: 'objectDetails',
        },
      },
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'projectDoc',
        },
      },
      {
        $addFields: {
          projectKey: { $arrayElemAt: ['$projectDoc.key', 0] },
          projectName: { $arrayElemAt: ['$projectDoc.name', 0] },
        },
      },
      {
        $project: {
          projectDoc: 0,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ]);

    // Фильтруем задачи, чтобы оставить только те, у которых есть координаты
    const filteredTasks = tasks.filter(
      (task) =>
        Array.isArray(task.bsLocation) &&
        task.bsLocation.some(
          (location: Location) => location && location.coordinates
        )
    );

    return NextResponse.json({ tasks: filteredTasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}
