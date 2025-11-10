// server-actions/users.ts

'use server';

import UserModel from 'src/app/models/UserModel';
import dbConnect from 'src/utils/mongoose';
import { currentUser } from '@clerk/nextjs/server';
import { MongoServerError } from 'mongodb';

dbConnect();

export const GetCurrentUserFromMongoDB = async () => {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return {
        success: false,
        message: 'No user session found',
      };
    }

    const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress?.toLowerCase();
    let user = await UserModel.findOne({ clerkUserId: clerkUser.id });

    if (!user && primaryEmail) {
      // Support legacy rows that were created before clerkUserId existed
      user = await UserModel.findOne({ email: primaryEmail });
      if (user && !user.clerkUserId) {
        user.clerkUserId = clerkUser.id;
        user.name = user.name || `${clerkUser?.firstName ?? ''} ${clerkUser?.lastName ?? ''}`.trim();
        user.profilePic = user.profilePic || clerkUser?.imageUrl || '';
        await user.save();
      }
    }

    if (user) {
      return {
        success: true,
        data: JSON.parse(JSON.stringify(user)),
      };
    }

    const fullName = `${clerkUser?.firstName ?? ''} ${clerkUser?.lastName ?? ''}`.trim();
    const newUser = new UserModel({
      name: fullName || clerkUser?.username || primaryEmail || 'Unknown User',
      email: primaryEmail || '',
      clerkUserId: clerkUser?.id,
      profilePic: clerkUser?.imageUrl || '',
      role: 'executor',
    });

    try {
      await newUser.save();
    } catch (error) {
      if (
        error instanceof MongoServerError &&
        error.code === 11000 &&
        primaryEmail
      ) {
        const existingUser = await UserModel.findOne({ email: primaryEmail });
        if (existingUser) {
          return {
            success: true,
            data: JSON.parse(JSON.stringify(existingUser)),
          };
        }
      }
      throw error;
    }

    return {
      success: true,
      data: JSON.parse(JSON.stringify(newUser)),
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      };
    }
    return {
      success: false,
      message: 'An unknown error occurred',
    };
  }
};
