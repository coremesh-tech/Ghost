import {useContext, useEffect, useRef, useState} from 'react';
import AppContext from '../../app-context';
import CloseButton from '../common/close-button';
import ActionButton from '../common/action-button';
import InputForm from '../common/input-form';
import {t} from '../../utils/i18n';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Email-only subscribe page (pure mailing-list style).
// Submits to /members/api/subscribe-direct: creates a free member, no verification,
// no session (no login). On success the popup closes and a corner toast is shown
// (handled by the subscribeDirect action), matching the sign-in success UX.
const SubscribePage = () => {
    const {doAction, brandColor, site, member, pageData, action} = useContext(AppContext);
    const [email, setEmail] = useState(pageData?.email || '');
    const [phonenumber, setPhonenumber] = useState('');
    const [errors, setErrors] = useState({});
    const errorTimer = useRef(null);

    // Clear the email error, cancelling any pending auto-hide timer.
    const clearError = () => {
        if (errorTimer.current) {
            clearTimeout(errorTimer.current);
            errorTimer.current = null;
        }
        setErrors({});
    };

    // Show a transient error that auto-hides (never stays permanently).
    const showEmailError = (message) => {
        if (errorTimer.current) {
            clearTimeout(errorTimer.current);
        }
        setErrors({email: message});
        errorTimer.current = setTimeout(() => {
            setErrors({});
            errorTimer.current = null;
        }, 4000);
    };

    useEffect(() => () => {
        if (errorTimer.current) {
            clearTimeout(errorTimer.current);
        }
        try {
            if (typeof window !== 'undefined') {
                window.__ratusSubscribeCtx = null;
            }
        } catch (e) {
            // ignore
        }
    }, []);

    const isRunning = action === 'subscribeDirect:running';

    const Header = ({title}) => (
        <div className="gh-portal-signup-header">
            {site?.icon ? <img className="gh-portal-signup-logo" src={site.icon} alt={site.title} /> : null}
            <h1 className="gh-portal-main-title">{title}</h1>
        </div>
    );

    // Already logged-in member: never show the email form — they are already on the list.
    if (member) {
        return (
            <div className='gh-portal-content gh-portal-subscribe'>
                <CloseButton />
                <Header title={t('You are already subscribed')} />
                <p className="gh-portal-text-center">{t('You are signed in as {email}.', {email: member.email})}</p>
                <ActionButton
                    style={{width: '100%'}}
                    onClick={() => doAction('switchPage', {page: 'accountHome'})}
                    brandColor={brandColor}
                    label={t('Manage subscription')}
                    disabled={false}
                    isRunning={false}
                />
            </div>
        );
    }

    // Email-only subscribe form (guest / logged-out)
    const submit = (e) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        if (isRunning) {
            return; // guard against double submit while the request is in flight
        }
        const trimmed = (email || '').trim();
        if (!trimmed || !EMAIL_RE.test(trimmed)) {
            showEmailError(t('Please enter a valid email address.'));
            return;
        }
        // Tag context stashed by the theme (topic-detail Follow) so the popup
        // subscribes to that tag's newsletter; absent for a plain whole-site subscribe.
        const context = (typeof window !== 'undefined' && window.__ratusSubscribeCtx) || undefined;
        clearError();
        doAction('subscribeDirect', {email: trimmed, phonenumber, context});
    };

    const fields = [
        {
            type: 'email',
            value: email,
            placeholder: t('you@example.com'),
            label: t('Email'),
            name: 'email',
            required: true,
            errorMessage: errors.email || '',
            autoFocus: true,
            disabled: isRunning
        }
    ];

    return (
        <div className='gh-portal-content gh-portal-subscribe'>
            <CloseButton />
            <Header title={t('Subscribe')} />
            <p className="gh-portal-text-center">{t('Get the latest updates delivered to your inbox.')}</p>
            <form onSubmit={submit} className="gh-portal-signup-form" noValidate>
                <InputForm
                    fields={fields}
                    onChange={(ev, field) => {
                        if (field.name === 'email') {
                            setEmail(ev.target.value);
                            // clear the error as soon as the user edits (do NOT re-validate here)
                            if (errors.email) {
                                clearError();
                            }
                        }
                    }}
                    onKeyDown={(ev) => {
                        if (ev.key === 'Enter') {
                            submit(ev);
                        }
                    }}
                />
                {/* Honeypot: real users never fill this; bots do. Sent as `phonenumber`. */}
                <input
                    type="text"
                    name="phonenumber"
                    value={phonenumber}
                    onChange={ev => setPhonenumber(ev.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    style={{position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0}}
                />
                <ActionButton
                    style={{width: '100%'}}
                    onClick={submit}
                    brandColor={brandColor}
                    label={t('Subscribe')}
                    isRunning={isRunning}
                    disabled={isRunning}
                />
            </form>
        </div>
    );
};

export default SubscribePage;
