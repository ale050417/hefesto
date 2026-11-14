import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import 'filamentos_api.dart';
import 'shared_widgets.dart';

/// Informe de stock en texto (el mismo que arma el botón "Informe" de la web):
/// se puede retocar, copiar o mandar por WhatsApp.
Future<void> showStockReportSheet(BuildContext context) {
  return showAppSheet<void>(context, builder: (_) => const _ReportSheet());
}

class _ReportSheet extends ConsumerStatefulWidget {
  const _ReportSheet();

  @override
  ConsumerState<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends ConsumerState<_ReportSheet> {
  static const _title = 'Informe de filamentos';

  final _text = TextEditingController();
  bool _loading = true;
  String? _error;

  /// "Copiado" en el botón por un par de segundos. (Un aviso —SnackBar— salía
  /// DETRÁS de la hoja y no se veía: parecía que el botón no hacía nada.)
  bool _copied = false;
  Timer? _copiedTimer;

  /// No se pudo abrir WhatsApp (se muestra arriba de los botones).
  String? _sendError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _copiedTimer?.cancel();
    _text.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final text = await ref.read(filamentosApiProvider).report();
      if (mounted) _text.text = text;
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _copy() async {
    try {
      await Clipboard.setData(ClipboardData(text: _text.text));
    } catch (_) {
      return;
    }
    if (!mounted) return;
    setState(() {
      _copied = true;
      _sendError = null;
    });
    _copiedTimer?.cancel();
    _copiedTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  Future<void> _send() async {
    var opened = false;
    try {
      opened = await openWhatsapp(null, _text.text);
    } catch (_) {
      opened = false;
    }
    if (!mounted) return;
    setState(() {
      _sendError = opened ? null : 'No pudimos abrir WhatsApp. Copiá el informe y pegalo en el chat.';
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const SheetBody(
        title: _title,
        children: [SizedBox(height: 160, child: LoadingView())],
      );
    }
    if (_error != null) {
      return SheetBody(
        title: _title,
        children: [ErrorView(message: _error!, onRetry: _load)],
      );
    }
    // Hoja estándar (2026-11-14, pedido de Ale): el texto —que puede ser largo—
    // se desplaza, y WhatsApp / Copiar quedan fijos y a la vista, también con
    // el teclado abierto y arriba de la barra del sistema.
    return SheetBody(
      title: _title,
      subtitle: 'Podés retocar el texto antes de copiarlo o mandarlo.',
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_sendError != null) ...[
            InlineError(_sendError!),
            const SizedBox(height: 10),
          ],
          // Uno debajo del otro: dos botones lado a lado no entran con fuente grande.
          GoldButton(label: 'WhatsApp', icon: Icons.send_rounded, onPressed: _send),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            icon: Icon(_copied ? Icons.check_rounded : Icons.copy_rounded, size: 18),
            label: Text(_copied ? 'Copiado' : 'Copiar'),
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            onPressed: _copy,
          ),
        ],
      ),
      children: [
        // Crece con el texto: lo que se desplaza es la hoja entera (un campo
        // con su propio desplazamiento adentro de la hoja era incómodo).
        TextField(
          controller: _text,
          maxLines: null,
          minLines: 6,
          style: const TextStyle(fontSize: 12.5, height: 1.4),
        ),
      ],
    );
  }
}
