/**
 * pages/VerifyResetCode.tsx
 * Paso 2 del flujo de recuperación: ingresar el código de 6 dígitos.
 *
 * Recibe el email desde ForgotPassword vía navigation state.
 * Llama a exchangeResetPasswordToken({ email, code }) para obtener el OTP.
 * Navega a /reset-password pasando el OTP vía state.
 */

import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AppLogo } from '@/components/brand/AppLogo';
import { Button } from '@/components/ui/Button';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { getInsforge } from '@/lib/insforge';

const CODE_LENGTH = 6;

export function VerifyResetCode() {
    const navigate = useNavigate();
    const location = useLocation();
    const email = (location.state as { email?: string } | null)?.email ?? '';

    const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
    const [busy, setBusy] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Si no hay email (acceso directo a la URL), redirigir
    if (!email) {
        return (
            <div className={APP_PAGE_CLASS}>
                <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 gap-4">
                    <p className="text-sm text-[var(--mc-color-text-secondary)]">
                        Enlace inválido. Por favor inicia el proceso de recuperación de nuevo.
                    </p>
                    <Link to="/forgot-password" className="mc-text-link">
                        → Ir a recuperar contraseña
                    </Link>
                </div>
            </div>
        );
    }

    const code = digits.join('');
    const codeCompleto = code.length === CODE_LENGTH && digits.every((d) => d !== '');

    function handleChange(index: number, value: string) {
        // Solo dígitos
        const val = value.replace(/\D/g, '').slice(-1);
        const next = [...digits];
        next[index] = val;
        setDigits(next);
        // Avanzar al siguiente campo si hay valor
        if (val && index < CODE_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    }

    function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    }

    function handlePaste(e: React.ClipboardEvent) {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
        if (!pasted) return;
        const next = Array(CODE_LENGTH).fill('');
        for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
        setDigits(next);
        // Mover foco al último dígito pegado
        const lastIdx = Math.min(pasted.length, CODE_LENGTH - 1);
        inputRefs.current[lastIdx]?.focus();
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!codeCompleto) return;
        setBusy(true);

        const { data, error } = await getInsforge().auth.exchangeResetPasswordToken({
            email,
            code,
        });

        setBusy(false);

        if (error || !data?.token) {
            toast.error('Código incorrecto o expirado. Solicita uno nuevo.');
            return;
        }

        // Pasamos el OTP a ResetPassword vía state
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
            setDigits(Array(CODE_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
        }
    }

    return (
        <div className={APP_PAGE_CLASS}>
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
                <div className="mb-6 flex justify-center">
                    <AppLogo height={40} />
                </div>
                <h1 className="text-[var(--mc-text-lg)] font-semibold text-[var(--mc-color-text)]">
                    Ingresa el código
                </h1>
                <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">
                    Enviamos un código de 6 dígitos a{' '}
                    <strong className="text-[var(--mc-color-text)]">{email}</strong>
                </h2>

                <form
                    onSubmit={(e) => void onSubmit(e)}
                    className="mt-6 flex flex-col gap-6 rounded-[var(--mc-radius-lg)] border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)] p-6"
                >
                    {/* Inputs de código */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }} onPaste={handlePaste}>
                        {digits.map((d, i) => (
                            <input
                                key={i}
                                ref={(el) => { inputRefs.current[i] = el; }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={d}
                                onChange={(e) => handleChange(i, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(i, e)}
                                autoFocus={i === 0}
                                style={{
                                    width: 44,
                                    height: 52,
                                    textAlign: 'center',
                                    fontSize: '22px',
                                    fontWeight: 600,
                                    borderRadius: 'var(--mc-radius-md)',
                                    border: `1.5px solid ${d ? 'var(--mc-color-accent)' : 'var(--mc-color-border)'}`,
                                    background: 'transparent',
                                    color: 'var(--mc-color-text)',
                                    outline: 'none',
                                    transition: 'border-color 0.15s',
                                    caretColor: 'var(--mc-color-accent)',
                                }}
                                aria-label={`Dígito ${i + 1} de ${CODE_LENGTH}`}
                            />
                        ))}
                    </div>

                    <Button type="submit" variant="primary" fullWidth disabled={busy || !codeCompleto}>
                        {busy ? 'Verificando…' : 'Verificar código'}
                    </Button>
                </form>

                <div className="mt-4 flex flex-col items-center gap-2">
                    <button
                        type="button"
                        className="mc-text-link"
                        disabled={busy}
                        onClick={() => void reenviarCodigo()}
                    >
                        ¿No recibiste el código? Reenviar
                    </button>
                    <Link to="/forgot-password" className="mc-text-link-muted">
                        ← Cambiar correo
                    </Link>
                </div>
            </div>
        </div>
    );
}