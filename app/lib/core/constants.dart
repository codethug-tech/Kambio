// App constants — Kambio Supabase project (pdntwbgylxjcpodficeg)
class AppConfig {
  static const supabaseUrl = 'https://pdntwbgylxjcpodficeg.supabase.co';
  static const supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkbnR3Ymd5bHhqY3BvZGZpY2VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5OTM1NTQsImV4cCI6MjA4NzU2OTU1NH0.YzMiKW5i-jIeBdgUzk5MeQOcbJMgS-HhkAnF3PRCfQA';

  // Backend API base URL — can be overridden at build time via --dart-define=API_URL=...
  static const apiBaseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://kambio.onrender.com/api',
  );

  // Venezuelan states for dropdowns
  static const List<String> states = [
    'Amazonas',
    'Anzoátegui',
    'Apure',
    'Aragua',
    'Barinas',
    'Bolívar',
    'Carabobo',
    'Cojedes',
    'Delta Amacuro',
    'Distrito Capital',
    'Falcón',
    'Guárico',
    'Lara',
    'Mérida',
    'Miranda',
    'Monagas',
    'Nueva Esparta',
    'Portuguesa',
    'Sucre',
    'Táchira',
    'Trujillo',
    'Vargas',
    'Yaracuy',
    'Zulia',
  ];

  static const List<String> categories = [
    'Electrónica',
    'Ropa y Calzado',
    'Alimentos',
    'Hogar',
    'Vehículos',
    'Servicios',
    'Inmuebles',
    'Animales',
    'Arte',
    'Juguetes',
    'Deportes',
    'Otros',
  ];
}
