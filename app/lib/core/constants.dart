// App constants — Kambio Supabase project (pdntwbgylxjcpodficeg)
class AppConfig {
  static const supabaseUrl = 'https://pdntwbgylxjcpodficeg.supabase.co';
  static const supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkbnR3Ymd5bHhqY3BvZGZpY2VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5OTM1NTQsImV4cCI6MjA4NzU2OTU1NH0.YzMiKW5i-jIeBdgUzk5MeQOcbJMgS-HhkAnF3PRCfQA';

  // ⚠️ IMPORTANT: Change this to your Render backend URL before building the release APK.
  // Build command: flutter build apk --release --dart-define=API_URL=https://your-app.onrender.com/api
  static const apiBaseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://YOUR-BACKEND.onrender.com/api',
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
