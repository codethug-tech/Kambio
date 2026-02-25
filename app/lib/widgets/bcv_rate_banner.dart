import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../theme/app_theme.dart';
import '../core/constants.dart';

/// BCV official exchange rates banner.
/// Primary source: Supabase `exchange_rates` table (realtime).
/// Fallback: backend GET /api/rates.
/// Shows an error with a retry button if both fail.
class BcvRateBanner extends StatefulWidget {
  const BcvRateBanner({super.key});

  @override
  State<BcvRateBanner> createState() => _BcvRateBannerState();
}

class _BcvRateBannerState extends State<BcvRateBanner> {
  Map<String, double> _rates = {};
  bool _loading = true;
  String? _error;
  DateTime? _updatedAt;
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    _load();
    _subscribeRealtime();
  }

  @override
  void dispose() {
    if (_channel != null) {
      Supabase.instance.client.removeChannel(_channel!);
    }
    super.dispose();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    // ── Try 1: Supabase direct query ─────────────────────────────────────
    try {
      final data = await Supabase.instance.client
          .from('exchange_rates')
          .select('currency, rate, updated_at')
          .order('currency')
          .timeout(const Duration(seconds: 8));

      final rates = <String, double>{};
      DateTime? ts;
      for (final row in (data as List)) {
        final rate = (row['rate'] as num? ?? 0).toDouble();
        if (rate > 0) {
          rates[row['currency'] as String] = rate;
        }
        final rowTs = DateTime.tryParse((row['updated_at'] as String?) ?? '');
        if (rowTs != null && (ts == null || rowTs.isAfter(ts))) ts = rowTs;
      }

      if (rates.isNotEmpty) {
        if (mounted) {
          setState(() {
            _rates = rates;
            _updatedAt = ts;
            _loading = false;
            _error = null;
          });
        }
        return;
      }
    } catch (e) {
      // Supabase failed — try backend route
      debugPrint('[BCV] Supabase error: $e');
    }

    // ── Try 2: Backend /api/rates ─────────────────────────────────────────
    try {
      final uri = Uri.parse('${AppConfig.apiBaseUrl}/rates');
      final res = await http.get(uri).timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        final list = jsonDecode(res.body) as List;
        final rates = <String, double>{};
        DateTime? ts;
        for (final row in list) {
          final rate = (row['rate'] as num? ?? 0).toDouble();
          if (rate > 0) rates[row['currency'] as String] = rate;
          final rowTs = DateTime.tryParse((row['updated_at'] as String?) ?? '');
          if (rowTs != null && (ts == null || rowTs.isAfter(ts))) ts = rowTs;
        }
        if (rates.isNotEmpty) {
          if (mounted) {
            setState(() {
              _rates = rates;
              _updatedAt = ts;
              _loading = false;
              _error = null;
            });
          }
          return;
        }
      }
    } catch (e) {
      debugPrint('[BCV] Backend error: $e');
    }

    // ── Both failed ────────────────────────────────────────────────────────
    if (mounted) {
      setState(() {
        _loading = false;
        _error = 'Sin conexión BCV';
      });
    }
  }

  void _subscribeRealtime() {
    _channel = Supabase.instance.client
        .channel('bcv-rates-${DateTime.now().millisecondsSinceEpoch}')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'exchange_rates',
          callback: (_) => _load(),
        )
        .subscribe();
  }

  String _fmt(double rate) {
    // e.g. 91.50 → "Bs 91,50"
    final parts = rate.toStringAsFixed(2).split('.');
    final whole = parts[0];
    final dec = parts.length > 1 ? parts[1] : '00';
    return 'Bs $whole,$dec';
  }

  String _timeAgo() {
    if (_updatedAt == null) return '';
    final diff = DateTime.now().toUtc().difference(_updatedAt!.toUtc());
    if (diff.inMinutes < 2) return 'ahora';
    if (diff.inHours < 1) return 'hace ${diff.inMinutes}min';
    if (diff.inHours < 24) return 'hace ${diff.inHours}h';
    return 'hace ${diff.inDays}d';
  }

  @override
  Widget build(BuildContext context) {
    // Loading skeleton
    if (_loading) {
      return Container(
        height: 36,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: KColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: KColors.divider),
        ),
        child: const Row(
          children: [
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 1.5,
                color: KColors.textHint,
              ),
            ),
            SizedBox(width: 8),
            Text(
              'Cargando tasas BCV...',
              style: TextStyle(fontSize: 11, color: KColors.textHint),
            ),
          ],
        ),
      );
    }

    // Error + retry
    if (_error != null) {
      return Container(
        height: 36,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: KColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: KColors.divider),
        ),
        child: Row(
          children: [
            const Icon(Icons.wifi_off, size: 14, color: KColors.textHint),
            const SizedBox(width: 6),
            Text(
              _error!,
              style: const TextStyle(fontSize: 11, color: KColors.textHint),
            ),
            const Spacer(),
            GestureDetector(
              onTap: _load,
              child: const Text(
                'Reintentar',
                style: TextStyle(
                  fontSize: 11,
                  color: KColors.green,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (_rates.isEmpty) return const SizedBox.shrink();

    final usd = _rates['USD'];
    final eur = _rates['EUR'];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: KColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KColors.divider),
      ),
      child: Row(
        children: [
          // BCV badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFFCC0001).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Text(
              'BCV',
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w800,
                color: Color(0xFFFF4444),
                letterSpacing: 0.5,
              ),
            ),
          ),
          const SizedBox(width: 10),

          // USD
          if (usd != null) ...[
            const Text('🇺🇸', style: TextStyle(fontSize: 14)),
            const SizedBox(width: 4),
            Text(
              _fmt(usd),
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: KColors.green,
                fontFamily: 'PlusJakartaSans',
              ),
            ),
          ],

          if (usd != null && eur != null)
            Container(
              height: 14,
              width: 1,
              margin: const EdgeInsets.symmetric(horizontal: 10),
              color: KColors.divider,
            ),

          // EUR
          if (eur != null) ...[
            const Text('🇪🇺', style: TextStyle(fontSize: 14)),
            const SizedBox(width: 4),
            Text(
              _fmt(eur),
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: KColors.blue,
              ),
            ),
          ],

          const Spacer(),

          // Timestamp + refresh icon
          Text(
            _timeAgo(),
            style: const TextStyle(fontSize: 10, color: KColors.textHint),
          ),
          const SizedBox(width: 4),
          GestureDetector(
            onTap: _load,
            child: const Icon(Icons.sync, size: 12, color: KColors.textHint),
          ),
        ],
      ),
    );
  }
}
