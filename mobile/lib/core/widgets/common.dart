import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../theme/app_theme.dart';

/// "78% 0%" (background-position de la web) → Alignment de Flutter.
Alignment parsePosition(String? position) {
  final parts = (position ?? '50% 50%').split(' ');
  double axis(String s) {
    final v = double.tryParse(s.replaceAll('%', '')) ?? 50;
    return (v / 100) * 2 - 1;
  }

  if (parts.length < 2) return Alignment.center;
  return Alignment(axis(parts[0]), axis(parts[1]));
}

/// Solo para los tests: en `true` las fotos de red no se piden ni se guardan
/// en disco y se ve el recuadro de "sin foto". En los tests no hay red ni
/// teléfono, y el caché en disco de `CachedNetworkImage` (carpeta + base del
/// sistema) hacía fallar las capturas (SHOT_DIR) de las pantallas con fotos.
bool debugDisableNetworkImages = false;

/// Imagen de red con caché, placeholder de marca y encuadre configurable.
class NetImage extends StatelessWidget {
  const NetImage(
    this.url, {
    super.key,
    this.position,
    this.fit = BoxFit.cover,
    this.radius = 0,
  });

  final String? url;
  final String? position;
  final BoxFit fit;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final placeholder = Container(
      color: c.surface2,
      alignment: Alignment.center,
      child: Icon(Icons.view_in_ar_rounded, color: c.textFaint, size: 32),
    );
    final Widget image = (url == null || url!.isEmpty || debugDisableNetworkImages)
        ? placeholder
        : LayoutBuilder(
            builder: (context, box) {
              // Las fotos se suben a 1600 px. Decodificarlas enteras para una
              // tarjeta de 170 dp gasta ~10 MB de memoria POR FOTO: en un
              // teléfono modesto el catálogo se traba o se cierra. Se
              // decodifican al tamaño en que se ven (con margen, para que no
              // pierdan nitidez al recortarlas), 2026-11-14.
              final side = math.max(
                box.maxWidth.isFinite ? box.maxWidth : 0.0,
                box.maxHeight.isFinite ? box.maxHeight : 0.0,
              );
              final dpr = MediaQuery.devicePixelRatioOf(context);
              final decode = side > 0 ? (side * dpr * 1.5).round().clamp(96, 1600) : null;
              return CachedNetworkImage(
                imageUrl: url!,
                fit: fit,
                alignment: parsePosition(position),
                memCacheWidth: decode,
                fadeInDuration: const Duration(milliseconds: 180),
                placeholder: (_, _) => Container(color: c.surface2),
                errorWidget: (_, _, _) => placeholder,
              );
            },
          );
    if (radius == 0) return image;
    return ClipRRect(borderRadius: BorderRadius.circular(radius), child: image);
  }
}

/// Logo de la marca (Hefesto + impresora 3D). Usa el que está cargado en la base
/// (Configuración → Negocio, el mismo de la web) y, si no hay red o todavía no
/// cargó, el logo EMPAQUETADO en la app: nunca se ve un hueco ni otro dibujo.
/// El PNG de la base trae mucho margen transparente; se encuadra para que el
/// dibujo ocupe el cuadro igual que el logo empaquetado.
class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.url, this.size = 48});
  final String? url;
  final double size;

  static const _asset = 'assets/brand/logo.png';

  @override
  Widget build(BuildContext context) {
    final bundled = Image.asset(_asset, fit: BoxFit.contain, filterQuality: FilterQuality.medium);
    final remote = (url == null || url!.isEmpty)
        ? null
        : CachedNetworkImage(
            imageUrl: url!,
            fit: BoxFit.contain,
            fadeInDuration: const Duration(milliseconds: 160),
            placeholder: (_, _) => Transform.scale(scale: 1 / 1.3, child: bundled),
            errorWidget: (_, _, _) => Transform.scale(scale: 1 / 1.3, child: bundled),
          );
    return SizedBox.square(
      dimension: size,
      child: ClipRect(
        child: remote == null ? bundled : Transform.scale(scale: 1.3, child: remote),
      ),
    );
  }
}

/// Botón principal dorado (gradiente de marca).
class GoldButton extends StatelessWidget {
  const GoldButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !loading;
    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: Material(
        color: Colors.transparent,
        child: Ink(
          decoration: BoxDecoration(
            gradient: Brand.goldGradient,
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: Brand.gold.withValues(alpha: 0.28),
                blurRadius: 14,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: enabled ? onPressed : null,
            child: Container(
              height: 50,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              width: expand ? double.infinity : null,
              alignment: Alignment.center,
              child: loading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.4,
                        color: Brand.goldFg,
                      ),
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (icon != null) ...[
                          Icon(icon, size: 20, color: Brand.goldFg),
                          const SizedBox(width: 8),
                        ],
                        // Un rótulo largo (o con letra grande) se corta con "…"
                        // en vez de desbordar el botón.
                        Flexible(
                          child: Text(
                            label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontFamily: 'Sora',
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              color: Brand.goldFg,
                            ),
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Encabezado de sección: eyebrow en mayúsculas + título + "Ver todo".
class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.eyebrow, required this.title, this.onSeeAll});
  final String eyebrow;
  final String title;
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 12, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  eyebrow.toUpperCase(),
                  style: const TextStyle(
                    fontFamily: 'Orbitron',
                    fontWeight: FontWeight.w700,
                    fontSize: 10.5,
                    letterSpacing: 2,
                    color: Brand.gold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(title, style: Theme.of(context).textTheme.headlineSmall),
              ],
            ),
          ),
          if (onSeeAll != null)
            TextButton(
              onPressed: onSeeAll,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Ver todo',
                      style: TextStyle(color: c.textDim, fontWeight: FontWeight.w600)),
                  const SizedBox(width: 4),
                  Icon(Icons.arrow_forward_rounded, size: 16, color: c.textDim),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key});
  @override
  Widget build(BuildContext context) =>
      const Center(child: CircularProgressIndicator(color: Brand.gold));
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return _CenteredNotice(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.cloud_off_rounded, size: 48, color: c.textFaint),
          const SizedBox(height: 14),
          Text(message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium),
          if (onRetry != null) ...[
            const SizedBox(height: 18),
            GoldButton(label: 'Reintentar', onPressed: onRetry, expand: false),
          ],
        ],
      ),
    );
  }
}

/// Centra un aviso (vacío, error, sin acceso) en el espacio disponible. Si el
/// espacio no alcanza —teléfono chico con el teclado abierto, letra grande—
/// el aviso se desplaza en vez de cortarse o desbordar.
class _CenteredNotice extends StatelessWidget {
  const _CenteredNotice({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final padded = Padding(padding: const EdgeInsets.all(32), child: child);
    return LayoutBuilder(
      builder: (context, box) {
        // Dentro de una lista (alto libre) no hay nada que centrar ni desplazar.
        if (!box.hasBoundedHeight) return Center(child: padded);
        return SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: box.maxHeight),
            child: Center(child: padded),
          ),
        );
      },
    );
  }
}

class EmptyView extends StatelessWidget {
  const EmptyView({super.key, required this.icon, required this.title, this.subtitle, this.action});
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return _CenteredNotice(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 84,
            height: 84,
            decoration: BoxDecoration(
              color: Brand.gold.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 38, color: Brand.gold),
          ),
          const SizedBox(height: 18),
          Text(title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge),
          if (subtitle != null) ...[
            const SizedBox(height: 8),
            Text(subtitle!,
                textAlign: TextAlign.center,
                style: TextStyle(color: c.textDim, height: 1.4)),
          ],
          if (action != null) ...[const SizedBox(height: 20), action!],
        ],
      ),
    );
  }
}

/// Abre WhatsApp (wa.me) con un mensaje precargado. `false` si no se pudo.
Future<bool> openWhatsapp(String? phone, String message) {
  final digits = (phone ?? '').replaceAll(RegExp(r'\D'), '');
  final text = Uri.encodeComponent(message);
  return openUrl(digits.isEmpty ? 'https://wa.me/?text=$text' : 'https://wa.me/$digits?text=$text');
}

/// Abre un enlace fuera de la app (navegador, teléfono, correo). `false` si no
/// se pudo. Nunca lanza: en un teléfono sin app para ese tipo de enlace (una
/// tablet sin teléfono, un equipo sin correo configurado) Android tira una
/// excepción y el botón parecía no hacer nada (2026-11-14).
Future<bool> openUrl(String url) async {
  try {
    return await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  } catch (_) {
    return false;
  }
}
