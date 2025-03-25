import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    profilePic: {
      type: String,
      required: true,
    },
    clerkUserId: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ['admin', 'manager', 'author', 'initiator', 'executor'],
      default: 'executor',
    },
  },
  { timestamps: true }
);

if (mongoose.models && mongoose.models['users']) {
  delete mongoose.models['users'];
}

const UserModel = mongoose.model('users', UserSchema);

export default UserModel;
