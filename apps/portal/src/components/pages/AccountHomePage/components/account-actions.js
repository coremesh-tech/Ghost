import AppContext from "../../../../app-context";
import { useContext, useState } from "react";
import {
    hasCommentsEnabled,
    hasMultipleNewsletters,
    isEmailSuppressed,
    hasNewsletterSendingEnabled,
} from "../../../../utils/helpers";
import { ReactComponent as LoaderIcon } from "../../../../images/icons/loader.svg";

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
    const [isJoining, setIsJoining] = useState(false);

    const handleJoinCreatorPlan = async () => {
        if (isJoining) {
            return;
        }
        setIsJoining(true);
        try {
            const url = `/members/api/predict_mixin/member_staff_apply`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "same-origin",
            });
            const data = await response.json();
            if (data?.predict_mixin?.id) {
                doAction("showPopupNotification", {
                    action: "showPopupNotification:success",
                    message: t("Successfully applied for creator plan"),
                    status: "success",
                });
            } else {
                doAction("showPopupNotification", {
                    action: "showPopupNotification:failed",
                    message: t("Failed to apply for creator plan"),
                    status: "error",
                });
            }
        } catch (error) {
            doAction("showPopupNotification", {
                action: "showPopupNotification:failed",
                message: error?.message || t("An error occurred"),
                status: "error",
            });
        } finally {
            setIsJoining(false);
        }
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
                        disabled={isJoining}
                    >
                        {isJoining ? (
                            <LoaderIcon className="gh-portal-billing-button-loader" />
                        ) : (
                            t("Join")
                        )}
                    </button>
                </section>
            </div>
        </div>
    );
};

export default AccountActions;
