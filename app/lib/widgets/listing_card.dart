import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_theme.dart';

class ListingCard extends StatelessWidget {
  final Map<String, dynamic> listing;
  const ListingCard({super.key, required this.listing});

  @override
  Widget build(BuildContext context) {
    final photos = (listing['listing_photos'] as List?) ?? [];
    final user = listing['users'] as Map<String, dynamic>?;
    final type = listing['type'] as String? ?? '';

    return GestureDetector(
      onTap: () => context.go('/home/listing/${listing['id']}'),
      child: Container(
        decoration: BoxDecoration(
          color: KColors.surface,
          borderRadius: BorderRadius.circular(16),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Photo
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  photos.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: photos[0]['url'],
                          fit: BoxFit.cover,
                        )
                      : Container(
                          color: KColors.surface2,
                          child: const Icon(
                            Icons.image_outlined,
                            color: KColors.textHint,
                            size: 40,
                          ),
                        ),
                  // Type badge
                  Positioned(top: 8, left: 8, child: _typeBadge(type)),
                ],
              ),
            ),
            // Info
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    listing['title'] ?? '',
                    style: KTextStyles.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Ofrezco: ${listing['offer_text'] ?? ''}',
                    style: KTextStyles.bodySmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    'Quiero: ${listing['want_text'] ?? ''}',
                    style: KTextStyles.bodySmall.copyWith(color: KColors.green),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  // User row
                  if (user != null)
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 10,
                          backgroundColor: KColors.surface2,
                          backgroundImage: user['avatar_url'] != null
                              ? CachedNetworkImageProvider(user['avatar_url'])
                              : null,
                          child: user['avatar_url'] == null
                              ? Text(
                                  (user['name'] as String)
                                      .substring(0, 1)
                                      .toUpperCase(),
                                  style: const TextStyle(
                                    fontSize: 9,
                                    color: KColors.textSecondary,
                                  ),
                                )
                              : null,
                        ),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            user['name'] ?? '',
                            style: KTextStyles.caption,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        RatingBarIndicator(
                          rating: (user['rating'] as num?)?.toDouble() ?? 0,
                          itemSize: 10,
                          itemBuilder: (_, _) =>
                              const Icon(Icons.star, color: KColors.warning),
                        ),
                      ],
                    ),
                  if (listing['city'] != null) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(
                          Icons.location_on_outlined,
                          size: 11,
                          color: KColors.textHint,
                        ),
                        const SizedBox(width: 2),
                        Text(listing['city'], style: KTextStyles.caption),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _typeBadge(String type) {
    final (label, color) = switch (type) {
      'cambio' => ('Cambio \$', KColors.blue),
      'trueque' => ('Trueque', KColors.green),
      'servicio' => ('Servicio', const Color(0xFFFF6E40)),
      _ => ('Otro', KColors.textHint),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
      ),
    );
  }
}
