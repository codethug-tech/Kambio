import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class KButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final bool outlined;
  final Color? color;
  final IconData? icon;

  const KButton({
    super.key,
    required this.label,
    this.onPressed,
    this.loading = false,
    this.outlined = false,
    this.color,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final bg = color ?? KColors.green;
    if (outlined) {
      return OutlinedButton.icon(
        onPressed: loading ? null : onPressed,
        icon: icon != null ? Icon(icon, size: 18) : const SizedBox.shrink(),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: bg),
          foregroundColor: bg,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: KTextStyles.label.copyWith(fontSize: 15),
        ),
      );
    }
    return ElevatedButton.icon(
      onPressed: loading ? null : onPressed,
      icon: loading
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.black,
              ),
            )
          : (icon != null
                ? Icon(icon, size: 18, color: Colors.black)
                : const SizedBox.shrink()),
      label: Text(label),
      style: ElevatedButton.styleFrom(
        backgroundColor: bg,
        foregroundColor: Colors.black,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: KTextStyles.label.copyWith(
          fontSize: 15,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
