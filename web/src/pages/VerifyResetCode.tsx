/**
 * pages/VerifyResetCode.tsx
 * Paso 2 del flujo de recuperación: ingresar el código de 6 dígitos.
 */

import { useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AppLogo } from '@/components/brand/AppLogo';
import { Button } from '@/components/ui/Button';
import { getInsforge } from '@/lib/insforge';

const CODE_LENGTH = 6;

export function VerifyResetCode() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? '';

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [busy, setBusy] = useState(false);
  const [otpInvalid, setOtpInvalid] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  if (!email) {
    return <Navigate to="/forgot-password" replace />;
  }

  const code = digits.join('');
  const codeCompleto = code.length === CODE_LENGTH && digits.every((d) => d !== '');

  function handleChange(index: number, value: string) {
    setOtpInvalid(false);
    const val = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = val;
    setDigits(next);
    if (val && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    setOtpInvalid(false);
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array(CODE_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!codeCompleto) return;
    setBusy(true);
    const { data, error } = await getInsforge().auth.exchangeResetPasswordToken({ email, code });
    setBusy(false);
    if (error || !data?.token) {
      setOtpInvalid(true);
      toast.error('Código incorrecto o expirado. Solicita uno nuevo.');
      return;
    }
    navigate('/reset-password', { state: { otp: data.token, email } });
  }

  async function reenviarCodigo() {
    setBusy(true);
    const { error } = await getInsforge().auth.sendResetPasswordEmail({ email });
    setBusy(false);
    if (error) {
      toast.error('No se pudo reenviar el código.');
    } else {
      toast.success('Código reenviado. Revisa tu correo.');
      setOtpInvalid(false);
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    }
  }

  return (
    <div className="mc-auth-page">
      <div className="mc-auth-container">
        <div className="mc-auth-logo">
          <AppLogo height={40} />
        </div>

        <div className="mc-auth-card">
          <div className="mc-auth-card-header">
            <h1 className="mc-auth-title">Ingresa el código</h1>
            <p className="mc-auth-subtitle">
              Enviamos un código de {CODE_LENGTH} dígitos a <strong>{email}</strong>
            </p>
          </div>

          <form onSubmit={(e) => void onSubmit(e)} className="mc-auth-form" noValidate>
            <span id="otp-group-label" className="mc-field-label">
              Código de verificación
            </span>
            <div
              className="mc-otp-group"
              role="group"
              aria-labelledby="otp-group-label"
              onPaste={handlePaste}
            >
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputRefs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  className={`mc-otp-input${d ? ' mc-otp-input--filled' : ''}`}
                  aria-invalid={otpInvalid ? true : undefined}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  autoFocus={i === 0}
                  aria-label={`Dígito ${i + 1} de ${CODE_LENGTH}`}
                />
              ))}
            </div>

            <Button type="submit" variant="primary" fullWidth disabled={busy || !codeCompleto}>
              {busy ? 'Verificando…' : 'Verificar código'}
            </Button>
          </form>
        </div>

        <div className="mc-auth-resend-group">
          <button
            type="button"
            className="mc-text-link"
            disabled={busy}
            onClick={() => void reenviarCodigo()}
          >
            ¿No recibiste el código? Reenviar
          </button>
          <Link to="/forgot-password" className="mc-auth-back-link">
            ← Cambiar correo
          </Link>
        </div>
      </div>
    </div>
  );
}
