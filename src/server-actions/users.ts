// server-actions/users.ts

'use server';

import UserModel, { type IUser } from 'src/app/models/UserModel';
import dbConnect from 'src/utils/mongoose';
import { currentUser } from '@clerk/nextjs/server';
import { MongoServerError } from 'mongodb';

dbConnect();

type UserSuccessResponse = {
  success: true;
  data: IUser;
};

type UserErrorResponse = {
  success: false;
  message: string;
};

export type GetCurrentUserResponse = UserSuccessResponse | UserErrorResponse;

const serializeUser = (user: unknown): IUser =>
  JSON.parse(JSON.stringify(user)) as IUser;

export const GetCurrentUserFromMongoDB =
  async (): Promise<GetCurrentUserResponse> => {
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
        if (!user.platformRole) {
          user.platformRole = 'user';
        }
        if (!user.profileType) {
          user.profileType = 'client';
        }
        if (!user.subscriptionTier) {
          user.subscriptionTier = 'free';
        }
        if (!user.billingStatus) {
          user.billingStatus = 'trial';
        }
        if (typeof user.activeOrgId === 'undefined') {
          user.activeOrgId = null;
        }
        if (typeof user.regionCode === 'undefined') {
          user.regionCode = '';
        }
        await user.save();
      }
    }

    if (user) {
      let needsSave = false;
      if (!user.platformRole) {
        user.platformRole = 'user';
        needsSave = true;
      }
      if (!user.profileType) {
        user.profileType = 'client';
        needsSave = true;
      }
      if (!user.subscriptionTier) {
        user.subscriptionTier = 'free';
        needsSave = true;
      }
      if (!user.billingStatus) {
        user.billingStatus = 'trial';
        needsSave = true;
      }
      if (typeof user.activeOrgId === 'undefined') {
        user.activeOrgId = null;
        needsSave = true;
      }
      if (typeof user.regionCode === 'undefined') {
        user.regionCode = '';
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }
      return {
        success: true,
        data: serializeUser(user),
      };
    }

    const fullName = `${clerkUser?.firstName ?? ''} ${clerkUser?.lastName ?? ''}`.trim();
    const newUser = new UserModel({
      name: fullName || clerkUser?.username || primaryEmail || 'Unknown User',
      email: primaryEmail || '',
      clerkUserId: clerkUser?.id,
      profilePic: clerkUser?.imageUrl || '',
      platformRole: 'user',
      profileType: 'client',
      subscriptionTier: 'free',
      billingStatus: 'trial',
      activeOrgId: null,
      regionCode: '',
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
            data: serializeUser(existingUser),
          };
        }
      }
      throw error;
    }

    return {
      success: true,
      data: serializeUser(newUser),
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
