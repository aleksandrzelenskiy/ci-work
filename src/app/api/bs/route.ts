// app/api/bs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import BaseStation from '@/app/models/BaseStation';
import dbConnect from '@/utils/mongoose';

export async function GET() {
  try {
    await dbConnect();

    // Агрегация для группировки и выбора последней версии
    const stations = await BaseStation.aggregate([
      {
        $group: {
          _id: '$name',
          doc: { $first: '$$ROOT' },
        },
      },
      {
        $replaceRoot: { newRoot: '$doc' },
      },
    ]);

    return NextResponse.json(stations);
  } catch (error) {
    console.error('Error fetching stations:', error);
    return NextResponse.json(
      { message: 'Ошибка загрузки базовых станций' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();

    if (!body.name || !body.coordinates) {
      return NextResponse.json(
        { message: 'Необходимо указать номер и координаты БС' },
        { status: 400 }
      );
    }

    const existingStation = await BaseStation.findOne({ name: body.name });
    if (existingStation) {
      return NextResponse.json(
        { message: 'Базовая станция с таким номером уже существует' },
        { status: 400 }
      );
    }

    const newStation = new BaseStation(body);
    await newStation.save();

    return NextResponse.json(newStation, { status: 201 });
  } catch (error) {
    console.error('Error creating station:', error);
    return NextResponse.json(
      { message: 'Ошибка создания базовой станции' },
      { status: 500 }
    );
  }
}
