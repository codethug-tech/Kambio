import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../theme/app_theme.dart';
import '../core/constants.dart';

/// BCV official exchange rates banner.
///
/// Fetch strategy (first success wins):
///   1. Supabase DB  — fast, cached, realtime-subscribed
///   2. Backend POST /api/rates/refresh — triggers a live fetch & DB update
///   3. open.er-api.com (VES + EUR/USD) — direct, no key needed
///   4. ve.dolarapi.com/v1/dolares/oficial — BCV-specific direct fetch
///
/// Refreshes automatically every 5 minutes and via Supabase Realtime.
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
  Timer? _refreshTimer;

  static const _staleThreshold = Duration(minutes: 5);

  @override
  void initState() {
    super.initState();
    _load();
    _subscribeRealtime();
    // Auto-refresh every 5 minutes
    _refreshTimer = Timer.periodic(const Duration(minutes: 5), (_) => _load());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    if (_channel != null) {
      Supabase.instance.client.removeChannel(_channel!);
    }
    super.dispose();
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  bool _isStale(DateTime? ts) {
    if (ts == null) return true;
    return DateTime.now().toUtc().difference(ts.toUtc()) > _staleThreshold;
  }

  void _applyRates(Map<String, double> rates, DateTime? ts) {
    if (!mounted) return;
    setState(() {
      _rates = rates;
      _updatedAt = ts;
      _loading = false;
      _error = null;
    });
  }

  // ── Source 1: Supabase DB ─────────────────────────────────────────────────
  Future<bool> _trySupabase() async {
    try {
      final data = await Supabase.instance.client
          .from('exchange_rates')
          .select('currency, rate, updated_at')
          .order('currency')
          .timeout(const Duration(seconds: 6));

      final rates = <String, double>{};
      DateTime? ts;
      for (final row in (data as List)) {
        final rate = (row['rate'] as num? ?? 0).toDouble();
        if (rate > 0) rates[row['currency'] as String] = rate;
        final rowTs = DateTime.tryParse((row['updated_at'] as String?) ?? '');
        if (rowTs != null && (ts == null || rowTs.isAfter(ts))) ts = rowTs;
      }

      if (rates.isNotEmpty && !_isStale(ts)) {
        _applyRates(rates, ts);
        return true;
      }
      // Data is present but stale — show it temporarily and keep loading
      if (rates.isNotEmpty && mounted) {
        setState(() {
          _rates = rates;
          _updatedAt = ts;
          _loading = false; // show something while we refresh
        });
      }
    } catch (e) {
      debugPrint('[BCV] Supabase error: $e');
    }
    return false;
  }

  // ── Source 2: Backend refresh endpoint ───────────────────────────────────
  Future<bool> _tryBackendRefresh() async {
    try {
      final uri = Uri.parse('${AppConfig.apiBaseUrl}/rates/refresh');
      final res = await http
          .post(uri, headers: {'Content-Type': 'application/json'})
          .timeout(const Duration(seconds: 12));
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        final freshRates = body['rates'] as Map<String, dynamic>?;
        final usd = (freshRates?['USD'] as num?)?.toDouble();
        final eur = (freshRates?['EUR'] as num?)?.toDouble();
        if (usd != null && usd > 0 && eur != null && eur > 0) {
          _applyRates({'USD': usd, 'EUR': eur}, DateTime.now());
          return true;
        }
      }
    } catch (e) {
      debugPrint('[BCV] Backend refresh error: $e');
    }
    return false;
  }

  // ── Source 3: open.er-api.com (direct live, no key) ─────────────────────
  Future<bool> _tryErApi() async {
    try {
      final uri = Uri.parse('https://open.er-api.com/v6/latest/USD');
      final res = await http.get(uri).timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        final j = jsonDecode(res.body) as Map<String, dynamic>;
        final vesUsd = (j['rates']?['VES'] as num?)?.toDouble();
        final eurPerUsd = (j['rates']?['EUR'] as num?)?.toDouble();
        if (vesUsd != null && vesUsd > 0 && eurPerUsd != null && eurPerUsd > 0) {
          _applyRates({
            'USD': vesUsd,
            'EUR': vesUsd / eurPerUsd, // Bs per 1 EUR
          }, DateTime.now());
          return true;
        }
      }
    } catch (e) {
      debugPrint('[BCV] er-api error: $e');
    }
    return false;
  }

  // ── Source 4: ve.dolarapi.com (BCV-specific, both endpoints direct) ─────────
  // Verified live 2026-04-05:
  //   /v1/dolares/oficial → { promedio: 473.9176 }  (compra/venta are null)
  //   /v1/euros           → { promedio: 545.94833602 }
  Future<bool> _tryDolarApi() async {
    try {
      final responses = await Future.wait([
        http
            .get(Uri.parse('https://ve.dolarapi.com/v1/dolares/oficial'))
            .timeout(const Duration(seconds: 10)),
        http
            .get(Uri.parse('https://ve.dolarapi.com/v1/euros'))
            .timeout(const Duration(seconds: 10)),
      ]);
      final jUsd = responses[0].statusCode == 200
          ? jsonDecode(responses[0].body) as Map<String, dynamic>
          : null;
      final jEur = responses[1].statusCode == 200
          ? jsonDecode(responses[1].body) as Map<String, dynamic>
          : null;
      final usd = (jUsd?['promedio'] as num?)?.toDouble();
      final eur = (jEur?['promedio'] as num?)?.toDouble();
      if (usd != null && usd > 0 && eur != null && eur > 0) {
        _applyRates({'USD': usd, 'EUR': eur}, DateTime.now());
        return true;
      }
    } catch (e) {
      debugPrint('[BCV] dolarapi error: $e');
    }
    return false;
  }

  // ── Main load orchestrator ─────────────────────────────────────────────────
  Future<void> _load() async {
    if (mounted) setState(() => _loading = _rates.isEmpty);

    // 1. Try Supabase (fresh data only)
    if (await _trySupabase()) return;

    // 2. Try backend refresh (updates DB + returns fresh rates)
    if (await _tryBackendRefresh()) return;

    // 3. Try direct live API (open.er-api.com)
    if (await _tryErApi()) return;

    // 4. Try direct live API (ve.dolarapi.com)
    if (await _tryDolarApi()) return;

    // All sources failed
    if (mounted) {
      setState(() {
        _loading = false;
        if (_rates.isEmpty) _error = 'Sin conexión BCV';
        // If we have stale rates, keep showing them — don't replace with error
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

  // ── Display helpers ───────────────────────────────────────────────────────

  String _fmt(double rate) {
    final parts = rate.toStringAsFixed(2).split('.');
    return 'Bs ${parts[0]},${parts.length > 1 ? parts[1] : '00'}';
  }

  String _timeAgo() {
    if (_updatedAt == null) return '';
    final diff = DateTime.now().toUtc().difference(_updatedAt!.toUtc());
    if (diff.inMinutes < 2) return 'ahora';
    if (diff.inHours < 1) return 'hace ${diff.inMinutes}min';
    if (diff.inHours < 24) return 'hace ${diff.inHours}h';
    return 'hace ${diff.inDays}d';
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    // Loading skeleton (only when we have nothing to show at all)
    if (_loading && _rates.isEmpty) {
      return _shell(
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

    // Error (only when we have nothing to show)
    if (_error != null && _rates.isEmpty) {
      return _shell(
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
    final isStale = _isStale(_updatedAt);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: KColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isStale
              ? KColors.warning.withValues(alpha: 0.4)
              : KColors.divider,
        ),
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
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: KColors.green,
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

          // Timestamp + refresh indicator
          if (_loading) ...[
            const SizedBox(
              width: 10,
              height: 10,
              child: CircularProgressIndicator(
                strokeWidth: 1.2,
                color: KColors.textHint,
              ),
            ),
            const SizedBox(width: 4),
          ] else ...[
            Text(
              _timeAgo(),
              style: TextStyle(
                fontSize: 10,
                color: isStale ? KColors.warning : KColors.textHint,
              ),
            ),
            const SizedBox(width: 4),
            GestureDetector(
              onTap: _load,
              child: Icon(
                Icons.sync,
                size: 12,
                color: isStale ? KColors.warning : KColors.textHint,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _shell({required Widget child}) {
    return Container(
      height: 36,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: KColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: KColors.divider),
      ),
      child: Row(children: [child]),
    );
  }
}
