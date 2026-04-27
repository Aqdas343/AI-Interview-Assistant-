import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      app: {
        title: "AI Interview Assistant",
        subtitle: "The undetectable AI meeting assistant",
        secureSession: "SECURE SESSION",
        authenticated: "Authenticated",
        startSession: "Start Assistant",
        stopSession: "Stop Assistant",
        transcript: "Real-time Transcript",
        suggestions: "AI Suggestions",
      },
      login: {
        email: "Email address",
        password: "Password",
        authenticate: "Continue",
        newToInfrastructure: "Don't have an account?",
        initializeAccount: "Create Account",
        authFailed: "Login failed",
        continueTo: "Continue to AI Interview Assistant"
      },
      register: {
        continueTo: "Continue to AI Interview Assistant",
        email: "Email address",
        enterEmail: "Enter your email address",
        continue: "Continue",
        alreadyInitialized: "Already have an account?",
        secureLogin: "Sign In",
        registerFailed: "Registration failed",
        protocolSuccessful: "Account Created!",
        redirecting: "Redirecting...",
        passwordsDoNotMatch: "Passwords do not match",
        google: "Google",
        apple: "Apple",
        or: "or"
      }
    }
  },
  es: {
    translation: {
      app: {
        title: "AI Interview Assistant",
        subtitle: "El asistente de reuniones AI indetectable",
        secureSession: "SESIÓN SEGURA",
        authenticated: "Autenticado",
        startSession: "Iniciar Asistente",
        stopSession: "Detener Asistente",
        transcript: "Transcripción en tiempo real",
        suggestions: "Sugerencias de IA",
      },
      login: {
        email: "Dirección de correo",
        password: "Contraseña",
        authenticate: "Continuar",
        newToInfrastructure: "¿No tienes cuenta?",
        initializeAccount: "Crear Cuenta",
        authFailed: "Error al iniciar sesión",
        continueTo: "Continuar a AI Interview Assistant"
      },
      register: {
        continueTo: "Continuar a AI Interview Assistant",
        email: "Dirección de correo",
        enterEmail: "Introduce tu correo electrónico",
        continue: "Continuar",
        alreadyInitialized: "¿Ya tienes cuenta?",
        secureLogin: "Iniciar Sesión",
        registerFailed: "Error en el registro",
        protocolSuccessful: "¡Cuenta Creada!",
        redirecting: "Redirigiendo...",
        passwordsDoNotMatch: "Las contraseñas no coinciden",
        google: "Google",
        apple: "Apple",
        or: "o"
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // react already safes from xss
    },
    react: {
      useSuspense: false
    }
  });

export default i18n;
