import { useEffect, useRef, useState, type FC } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number;
              locale?: string;
            }
          ) => void;
          prompt?: (notification?: (notification: unknown) => void) => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => void;
  onError?: (errorMessage: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  shape?: 'rectangular' | 'pill';
  disabled?: boolean;
}

export const GoogleSignInButton: FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  text = 'continue_with',
  shape = 'rectangular',
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendered, setIsRendered] = useState(false);

  // Keep the latest callbacks in refs so inline functions from parents
  // do not retrigger the effect (and the Google button re-render).
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    const clientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      '247427692106-2vn9la944ep0rl6m3vdthmo7n0nlgbo4.apps.googleusercontent.com';

    let isMounted = true;

    const renderGoogleBtn = () => {
      if (!isMounted || !containerRef.current || !window.google?.accounts?.id) return;

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential: string }) => {
            if (response?.credential) {
              onSuccessRef.current(response.credential);
            } else {
              onErrorRef.current?.('No se recibió la credencial de autenticación de Google');
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        containerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'filled_black',
          size: 'large',
          text,
          shape,
          logo_alignment: 'left',
          locale: 'es',
        });

        setIsRendered(true);
      } catch (err) {
        console.error('Error rendering Google Sign-In button:', err);
        onErrorRef.current?.('No se pudo inicializar el botón de Google');
      }
    };

    if (window.google?.accounts?.id) {
      renderGoogleBtn();
    } else {
      // Check if script tag is already in DOM
      let script = document.querySelector<HTMLScriptElement>(
        'script[src="https://accounts.google.com/gsi/client"]'
      );
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderGoogleBtn);
    }

    return () => {
      isMounted = false;
    };
  }, [text, shape]);

  return (
    <div className={`w-full flex justify-center items-center min-h-[44px] ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div
        ref={containerRef}
        className="w-full flex justify-center [&>div]:!w-full [&>iframe]:!w-full [&>iframe]:!rounded-xl shadow-lg"
        style={{ display: isRendered ? 'flex' : 'none' }}
      />
      {!isRendered && (
        <div className="fade-btn-secondary w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 text-xs font-semibold tracking-wide text-white/60 bg-white/5 border border-white/10">
          <svg className="w-4 h-4 animate-spin text-[#B68F4E]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Conectando con Google...</span>
        </div>
      )}
    </div>
  );
};
