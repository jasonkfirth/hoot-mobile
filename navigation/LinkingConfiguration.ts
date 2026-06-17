/**
    Project: Hoot Mobile
    -------------------

    File: LinkingConfiguration.ts

    Purpose:

        Configures deep linking for the application, mapping URL paths
        to specific screens and their parameters.

    Responsibilities:

        • Define URL prefixes for the application
        • Map URL paths to navigation stack/tab routes
        • Configure parameter parsing for deep linked routes

    This file intentionally does NOT contain:

        • Navigation structure definitions (see navigation/index.tsx)
        • Screen implementations
*/

import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';

import { RootStackParamList } from '../types';

/* ------------------------------------------------------------------------- */
/* Deep Linking Configuration                                                */
/* ------------------------------------------------------------------------- */

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/')],
  config: {
    screens: {
      Root: {
        screens: {
          FeedScreen: {
            path: 'feed/:sort',
            parse: {
              sort: (sort: string) => sort as any,
            },
          },
          SearchScreen: 'search',
          NewPostScreen: 'new-post',
          NotificationScreen: 'notifications',
          ProfileScreen: 'profile',
        },
      },
      Post: 'post/:postId',
      Comment: 'comment/:id',
      Community: {
        path: 'community/:id',
        parse: {
          id: (id: string) => Number(id),
        },
      },
      ProfileActivity: {
        path: 'users/:userId/activity',
        parse: {
          userId: (userId: string) => Number(userId),
        },
      },
      Moderation: 'moderation',
      Settings: 'settings',
      NotFound: '*',
    },
  },
};

export default linking;

/* end of LinkingConfiguration.ts */
