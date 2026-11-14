import 'package:flutter/material.dart';

/// Un módulo del panel (los mismos que el menú lateral de la web).
class AdminModuleInfo {
  const AdminModuleInfo({
    required this.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.group,
    required this.permission,
    required this.route,
  });

  final String key;
  final String title;
  final String subtitle;
  final IconData icon;
  final String group;

  /// Módulo de permisos del servidor (`PERM_MODULES`): se muestra solo si el
  /// usuario tiene `ver` sobre él.
  final String permission;
  final String route;
}

/// Orden y agrupación = sidebar de la web.
const adminModules = <AdminModuleInfo>[
  AdminModuleInfo(
    key: 'clientes',
    title: 'Clientes',
    subtitle: 'Compras, nivel y contacto',
    icon: Icons.groups_rounded,
    group: 'Ventas',
    permission: 'clientes',
    route: '/admin/m/clientes',
  ),
  AdminModuleInfo(
    key: 'produccion',
    title: 'Cola de impresión',
    subtitle: 'Qué se imprime y en qué orden',
    icon: Icons.print_rounded,
    group: 'Producción',
    permission: 'produccion',
    route: '/admin/m/produccion',
  ),
  AdminModuleInfo(
    key: 'filamentos',
    title: 'Filamentos',
    subtitle: 'Stock, carga y ajustes',
    icon: Icons.donut_large_rounded,
    group: 'Producción',
    permission: 'filamentos',
    route: '/admin/stock',
  ),
  AdminModuleInfo(
    key: 'fallas',
    title: 'Impresiones fallidas',
    subtitle: 'Registro de piezas perdidas',
    icon: Icons.report_problem_rounded,
    group: 'Producción',
    permission: 'fallas',
    route: '/admin/m/fallas',
  ),
  AdminModuleInfo(
    key: 'productos',
    title: 'Productos',
    subtitle: 'Catálogo, precios y fotos',
    icon: Icons.inventory_2_rounded,
    group: 'Catálogo',
    permission: 'productos',
    route: '/admin/m/productos',
  ),
  AdminModuleInfo(
    key: 'categorias',
    title: 'Categorías',
    subtitle: 'Orden y estructura de la tienda',
    icon: Icons.category_rounded,
    group: 'Catálogo',
    permission: 'productos',
    route: '/admin/m/categorias',
  ),
  AdminModuleInfo(
    key: 'descuentos',
    title: 'Descuentos',
    subtitle: 'Cupones y promociones',
    icon: Icons.local_offer_rounded,
    group: 'Crecimiento',
    permission: 'descuentos',
    route: '/admin/m/descuentos',
  ),
  AdminModuleInfo(
    key: 'recompensas',
    title: 'Recompensas',
    subtitle: 'Puntos y beneficios',
    icon: Icons.card_giftcard_rounded,
    group: 'Crecimiento',
    permission: 'recompensas',
    route: '/admin/m/recompensas',
  ),
  AdminModuleInfo(
    key: 'reportes',
    title: 'Reportes',
    subtitle: 'Ventas, productos y consumo',
    icon: Icons.insights_rounded,
    group: 'Análisis',
    permission: 'reportes',
    route: '/admin/m/reportes',
  ),
  AdminModuleInfo(
    key: 'ganancias',
    title: 'Ganancias y socios',
    subtitle: 'Reparto de lo que se gana',
    icon: Icons.account_balance_wallet_rounded,
    group: 'Análisis',
    permission: 'ganancias',
    route: '/admin/m/ganancias',
  ),
  AdminModuleInfo(
    key: 'calculadora',
    title: 'Calculadora 3D',
    subtitle: 'Costo y precio de una pieza',
    icon: Icons.calculate_rounded,
    group: 'Análisis',
    permission: 'calculadora',
    route: '/admin/m/calculadora',
  ),
  AdminModuleInfo(
    key: 'configuracion',
    title: 'Configuración',
    subtitle: 'Negocio, tienda y contacto',
    icon: Icons.settings_rounded,
    group: 'Sistema',
    permission: 'config',
    route: '/admin/m/configuracion',
  ),
  AdminModuleInfo(
    key: 'auditoria',
    title: 'Auditoría',
    subtitle: 'Quién hizo qué y cuándo',
    icon: Icons.fact_check_rounded,
    group: 'Sistema',
    permission: 'auditoria',
    route: '/admin/m/auditoria',
  ),
];
