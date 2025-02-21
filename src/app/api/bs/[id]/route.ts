// app/api/bs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import BaseStation from 'src/app/models/BaseStation';
import dbConnect from 'src/utils/mongoose';

export async function PUT(req: NextRequest) {
  await dbConnect();
  try {
    // Получаем ID из URL вручную
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return NextResponse.json(
        { message: 'Неверный ID станции' },
        { status: 400 }
      );
    }

    const body = await req.json();

    const existingStation = await BaseStation.findById(id);
    if (!existingStation) {
      return NextResponse.json(
        { message: 'Базовая станция не найдена' },
        { status: 404 }
      );
    }

    if (body.name) {
      const duplicateStation = await BaseStation.findOne({
        name: body.name,
        _id: { $ne: id },
      });
      if (duplicateStation) {
        return NextResponse.json(
          { message: 'Базовая станция с таким номером уже существует' },
          { status: 400 }
        );
      }
    }

    existingStation.name = body.name || existingStation.name;
    existingStation.coordinates =
      body.coordinates || existingStation.coordinates;
    await existingStation.save();

    return NextResponse.json(existingStation);
  } catch (error) {
    console.error('Error updating station:', error);
    return NextResponse.json(
      { message: 'Ошибка обновления базовой станции' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  await dbConnect();
  try {
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return NextResponse.json(
        { message: 'Неверный ID станции' },
        { status: 400 }
      );
    }

    const deletedStation = await BaseStation.findByIdAndDelete(id);
    if (!deletedStation) {
      return NextResponse.json(
        { message: 'Базовая станция не найдена' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Базовая станция успешно удалена' });
  } catch (error) {
    console.error('Error deleting station:', error);
    return NextResponse.json(
      { message: 'Ошибка удаления базовой станции' },
      { status: 500 }
    );
  }
}
