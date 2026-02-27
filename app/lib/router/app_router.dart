import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../screens/splash_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/signup_screen.dart';
import '../screens/auth/onboarding_screen.dart';
import '../screens/home/home_screen.dart';
import '../screens/listing/listing_detail_screen.dart';
import '../screens/listing/create_listing_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/chat/chat_list_screen.dart';
import '../screens/chat/chat_screen.dart';
import '../screens/favorites/favorites_screen.dart';
import '../screens/settings/settings_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final session = Supabase.instance.client.auth.currentSession;
      final isAuth = session != null;
      final loc = state.uri.path;

      // Always allow splash and onboarding
      if (loc == '/splash' || loc == '/onboarding') return null;

      // Public routes
      if (loc == '/login' || loc == '/signup') {
        return isAuth ? '/home' : null;
      }

      // Protected routes
      return isAuth ? null : '/login';
    },
    routes: [
      GoRoute(path: '/splash', builder: (c, s) => const SplashScreen()),
      GoRoute(path: '/login', builder: (c, s) => const LoginScreen()),
      GoRoute(path: '/signup', builder: (c, s) => const SignupScreen()),
      GoRoute(path: '/onboarding', builder: (c, s) => const OnboardingScreen()),
      GoRoute(
        path: '/home',
        builder: (c, s) => const HomeScreen(),
        routes: [
          GoRoute(
            path: 'listing/new',
            builder: (c, s) => const CreateListingScreen(),
          ),
          GoRoute(
            path: 'listing/:id',
            builder: (c, s) => ListingDetailScreen(id: s.pathParameters['id']!),
          ),
          GoRoute(
            path: 'listing/:id/edit',
            builder: (c, s) =>
                CreateListingScreen(editId: s.pathParameters['id']),
          ),
          GoRoute(
            path: 'profile/:id',
            builder: (c, s) => ProfileScreen(userId: s.pathParameters['id']!),
          ),
          GoRoute(
            path: 'chat',
            builder: (c, s) => const ChatListScreen(),
            routes: [
              GoRoute(
                path: ':threadId',
                builder: (c, s) =>
                    ChatScreen(threadId: s.pathParameters['threadId']!),
              ),
            ],
          ),
          GoRoute(
            path: 'favorites',
            builder: (c, s) => const FavoritesScreen(),
          ),
          GoRoute(path: 'settings', builder: (c, s) => const SettingsScreen()),
        ],
      ),
    ],
  );
});
