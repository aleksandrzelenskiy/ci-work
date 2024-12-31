import { NextResponse } from 'next/server';
import clientPromise from '@/utils/mongodb';
import { currentUser } from '@clerk/nextjs/server';

export async function POST(request: Request) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json(
      { error: 'User is not authenticated' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { fileUrl, task, baseId, comment } = body;

  if (!fileUrl || !task || !baseId || !comment) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db('photo_reports');
    const collection = db.collection('comments');

    await collection.insertOne({
      fileUrl,
      task,
      baseId,
      comment,
      userId: user.id,
      userName: `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim(),
      createdAt: new Date(),
    });

    return NextResponse.json({ message: 'Comment added successfully' });
  } catch (error) {
    console.error('Error saving comment:', error);
    return NextResponse.json(
      { error: 'Failed to save comment' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const task = url.searchParams.get('task');
  const baseId = url.searchParams.get('baseId');

  if (!task || !baseId) {
    return NextResponse.json(
      { error: 'Missing task or baseId' },
      { status: 400 }
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db('photo_reports');
    const collection = db.collection('comments');

    const comments = await collection
      .find({ task, baseId })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}
