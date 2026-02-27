import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../theme/app_theme.dart';
import '../../widgets/k_button.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<Map<String, String>> _onboardingData = [
    {
      'title': '¡Bienvenido a Kambio!',
      'description':
          'La plataforma para intercambiar, vender o comprar artículos. ¡Encuentra grandes oportunidades cerca de ti!',
      'icon': '👋',
    },
    {
      'title': '¿Cómo funciona?',
      'description':
          'Publica tus artículos con fotos. Explora lo que otros ofrecen. Si te interesa algo, inicia un chat y propón un trato.',
      'icon': '🔄',
    },
    {
      'title': 'Seguridad ante todo',
      'description':
          'Acuerda los detalles en el chat. Nunca transfieras dinero sin verificar el estado del producto en persona.',
      'icon': '🛡️',
    },
    {
      'title': 'Comunidad de confianza',
      'description':
          'Después de cada intercambio, califica a la otra persona para ayudar a mantener una comunidad segura y confiable.',
      'icon': '⭐',
    },
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KColors.bg,
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.topRight,
              child: TextButton(
                onPressed: () => context.go('/home'),
                child: Text(
                  'Saltar',
                  style: KTextStyles.body.copyWith(
                    color: KColors.textSecondary,
                  ),
                ),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                onPageChanged: (value) {
                  setState(() {
                    _currentPage = value;
                  });
                },
                itemCount: _onboardingData.length,
                itemBuilder: (context, index) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 40.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _onboardingData[index]['icon']!,
                          style: const TextStyle(fontSize: 100),
                        ),
                        const SizedBox(height: 48),
                        Text(
                          _onboardingData[index]['title']!,
                          style: KTextStyles.h1.copyWith(fontSize: 28),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          _onboardingData[index]['description']!,
                          style: KTextStyles.body.copyWith(
                            color: KColors.textSecondary,
                            height: 1.5,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      _onboardingData.length,
                      (index) => _buildDot(index: index),
                    ),
                  ),
                  const SizedBox(height: 32),
                  KButton(
                    label: _currentPage == _onboardingData.length - 1
                        ? 'Empezar'
                        : 'Siguiente',
                    onPressed: () {
                      if (_currentPage == _onboardingData.length - 1) {
                        context.go('/home');
                      } else {
                        _pageController.nextPage(
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeIn,
                        );
                      }
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDot({required int index}) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      margin: const EdgeInsets.only(right: 8),
      height: 8,
      width: _currentPage == index ? 24 : 8,
      decoration: BoxDecoration(
        color: _currentPage == index ? KColors.green : KColors.surface2,
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}
