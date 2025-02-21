import mongoose from 'mongoose';

export interface IBaseStation extends mongoose.Document {
  name: string;
  coordinates: string;
}

const BaseStationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    coordinates: {
      type: String,
      required: true,
    },
  },
  { collection: 'objects-t2-ir' }
);

// Предварительная обработка для удаления дубликатов
BaseStationSchema.pre('save', async function (next) {
  const existing = await mongoose.models.BaseStation.findOne({
    name: this.name,
  });
  if (existing) {
    await mongoose.models.BaseStation.deleteOne({ name: this.name });
  }
  next();
});

export default mongoose.models.BaseStation ||
  mongoose.model<IBaseStation>('BaseStation', BaseStationSchema);
