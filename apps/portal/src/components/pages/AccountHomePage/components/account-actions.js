import AppContext from "../../../../app-context";
import { useContext } from "react";
import {
    hasCommentsEnabled,
    hasMultipleNewsletters,
    isEmailSuppressed,
    hasNewsletterSendingEnabled,
} from "../../../../utils/helpers";

import PaidAccountActions from "./paid-account-actions";
import TransistorPodcastsAction from "./transistor-podcasts-action";
import EmailNewsletterAction from "./email-newsletter-action";
import EmailPreferencesAction from "./email-preferences-action";
import useIntegrations from "./use-integrations";
import { t } from "../../../../utils/i18n";

const shouldShowEmailPreferences = (site, member) => {
    return (
        (hasMultipleNewsletters({ site }) &&
            hasNewsletterSendingEnabled({ site })) ||
        hasCommentsEnabled({ site }) ||
        isEmailSuppressed({ member })
    );
};

const shouldShowEmailNewsletterAction = (site) => {
    return (
        !hasMultipleNewsletters({ site }) &&
        hasNewsletterSendingEnabled({ site }) &&
        !hasCommentsEnabled({ site })
    );
};

const AccountActions = () => {
    const { member, doAction, site } = useContext(AppContext);
    const { name, email } = member;
    const { transistor } = useIntegrations();

    const openEditProfile = () => {
        doAction("switchPage", {
            page: "accountProfile",
            lastPage: "accountHome",
        });
    };

    const showEmailPreferences = shouldShowEmailPreferences(site, member);
    const showEmailNewsletterAction = shouldShowEmailNewsletterAction(site);

    const handleJoinCreatorPlan = () => {
        const subject = `Application: Analyst Contributor Program — ${name}`;

        const body = `Dear predictionmarkets.org Team,

I am writing to apply for the Analyst Contributor Program at predictionmarkets.org. 
I have a strong interest in prediction markets and would like to contribute original research and analysis to your platform.

------------------------
About me:
- Name: ${name || "[Your Full Name]"}
- Professional background: [e.g., economist, quantitative analyst, policy researcher, journalist]
- Languages: [e.g., English, Mandarin Chinese]
- Portfolio / prior work: [link to blog, Substack, LinkedIn, GitHub, or articles]

------------------------
Domain expertise:
[Describe your focus areas — e.g., macroeconomics, geopolitics, technology, energy, public health, sports]

------------------------
Content I plan to publish:
[Describe format and cadence — forecast analyses, market commentary, research notes, explainers]

------------------------
Sample work:
[Link or describe a piece demonstrating your analytical ability]

------------------------
Requested tier:
[ ] Associate Analyst
[ ] Senior Analyst (include track record below)

------------------------
Additional information:
[Any other relevant background or questions]

------------------------
I look forward to contributing to the predictionmarkets.org community.

Best regards,
${name || "[Your Full Name]"}
${email || "[Email Address]"}
[Optional: Time zone / Location]`;

        window.location.href = `mailto:creators@mails.predictionmarkets.org?subject=${encodeURIComponent(
            subject
        )}&body=${encodeURIComponent(body)}`;
    };

    return (
        <div>
            <div className="gh-portal-list">
                <section>
                    <div className="gh-portal-list-detail">
                        <h3>{name ? name : t("Account")}</h3>
                        <p>{email}</p>
                    </div>
                    <button
                        data-test-button="edit-profile"
                        className="gh-portal-btn gh-portal-btn-list"
                        onClick={(e) => openEditProfile(e)}
                    >
                        {t("Edit")}
                    </button>
                </section>

                <PaidAccountActions />
                {showEmailPreferences && <EmailPreferencesAction />}
                {showEmailNewsletterAction && <EmailNewsletterAction />}
                {transistor.enabled && (
                    <TransistorPodcastsAction
                        hasPodcasts={transistor.hasPodcasts}
                        memberUuid={transistor.memberUuid}
                        settings={transistor.settings}
                    />
                )}
                <section>
                    <div className="gh-portal-list-detail">
                        <h3>{t("Analyst Contributor Program")}</h3>
                        <a>{t("See more")}</a>
                    </div>
                    <button
                        data-test-button="edit-profile"
                        className="gh-portal-btn gh-portal-btn-list"
                        onClick={handleJoinCreatorPlan}
                    >
                        {t("Join")}
                    </button>
                </section>
            </div>
        </div>
    );
};

export default AccountActions;
