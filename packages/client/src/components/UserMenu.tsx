"use client";

import { useState, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Book, LogOut, MessageSquare, Moon, Sun } from "lucide-react";
import type { Organization } from "@zdocs/types";
import { ContextMenu } from "@zdocs/client-component";
import { useAppStore } from "../context-providers/appStore";
import useOrgStore from "../context-providers/orgStore";
import { useTheme } from "../hooks/useTheme";
import { ContactUsDialog } from "./ContactUsDialog";
import { ProfileDialog } from "./profile/ProfileDialog";
import { getSystemApps, SystemApp } from "../pages/app/utils/systemApps";
import { IS_DOC_VISION } from "@zdocs/util";
import { useLogUserJourneyEvent } from "../utilities/api/logUserJourneyEventApi";

interface UserMenuProps {
    onLogout?: () => void;
    onOpenSettings?: (org: Organization) => void;
    onOpenCreateDialog?: () => void;
}

export function UserMenu({
    onLogout,
    onOpenSettings,
    onOpenCreateDialog,
}: UserMenuProps) {
    const t = useTranslations("appPage");
    const router = useRouter();
    const pathname = usePathname();

    const { loginUser } = useAppStore();
    const { org, setOrg, organizations } = useOrgStore();
    const { isDark, toggleTheme } = useTheme();
    const { logEvent } = useLogUserJourneyEvent();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isContactUsDialogOpen, setIsContactUsDialogOpen] = useState(false);
    const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
    const avatarRef = useRef<HTMLButtonElement>(null);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

    const pathFirstPart = useMemo(() => {
        if (!pathname) return null;
        return pathname.split("/")[1];
    }, [pathname]);

    const handleOrgSelect = (selectedOrg: Organization) => {
        logEvent({
            eventType: "browse_header_org_switched",
            eventData: {
                orgId: selectedOrg.id,
                previousOrgId: org?.id || null,
                source: "mobile_menu",
            },
        });
        setOrg(selectedOrg);
        setIsMenuOpen(false);
        router.push("/");
    };

    // const handleDeleteOrg = async (orgToDelete: Organization) => {
    //     const confirmed = await confirm({
    //         title: tOrgs("deleteTitle"),
    //         message: tOrgs("deleteConfirmation", { name: orgToDelete.name }),
    //         confirmLabel: tOrgs("delete"),
    //         cancelLabel: tOrgs("cancel"),
    //     });

    //     if (!confirmed) return;

    //     setDeletingOrgId(orgToDelete.id);
    //     try {
    //         await zFetch(`/api/org/${orgToDelete.id}/delete`, {
    //             method: "POST",
    //         });

    //         setOrganizations((prev) =>
    //             prev.filter((o) => o.id !== orgToDelete.id)
    //         );

    //         if (org?.id === orgToDelete.id) {
    //             const remainingOrgs = organizations.filter(
    //                 (o) => o.id !== orgToDelete.id
    //             );
    //             if (remainingOrgs.length > 0) {
    //                 setOrg(remainingOrgs[0]);
    //                 router.push("/");
    //             } else {
    //                 setOrg(null);
    //                 router.push("/");
    //             }
    //         }

    //         toast.success(tOrgs("deleted"));
    //     } catch (error) {
    //         console.error("Failed to delete organization:", error);
    //         toast.error(tOrgs("failedToDelete"));
    //     } finally {
    //         setDeletingOrgId(null);
    //     }
    // };

    const handleMenuClick = () => {
        const rect = avatarRef.current?.getBoundingClientRect();
        if (rect) {
            // Calculate position to ensure menu stays within viewport
            // Account for: content width (200px) + padding (16px) + border (2px) + shadow
            const menuContentWidth = 200; // min-w-[200px]
            const menuPadding = 16; // p-2 = 8px * 2
            const menuBorder = 2; // border = 1px * 2
            const menuTotalWidth = menuContentWidth + menuPadding + menuBorder;
            const menuHeight = 150; // approximate height
            const viewportPadding = 8; // Safety margin from viewport edge

            let x = rect.left;
            let y = rect.bottom + viewportPadding;

            // Adjust horizontal position if menu would go off right edge
            // Align right edge of menu with right edge of viewport (with padding)
            if (x + menuTotalWidth > window.innerWidth - viewportPadding) {
                x = window.innerWidth - menuTotalWidth - viewportPadding;
            }

            // Ensure menu doesn't go off left edge either
            if (x < viewportPadding) {
                x = viewportPadding;
            }

            // Adjust vertical position if menu would go off bottom edge
            if (y + menuHeight > window.innerHeight - viewportPadding) {
                y = rect.top - menuHeight - viewportPadding;
            }

            // Ensure menu doesn't go off top edge
            if (y < viewportPadding) {
                y = viewportPadding;
            }

            setMenuPosition({ x, y });
        }
        setIsMenuOpen(true);
        logEvent({
            eventType: "browse_header_user_menu_opened",
        });
    };

    // Get user initials from name or email
    const getUserInitials = () => {
        if (!loginUser) return "?";

        if (loginUser.name && loginUser.name.trim()) {
            const names = loginUser.name.trim().split(" ");
            if (names.length > 1) {
                return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
            }
            return loginUser.name[0].toUpperCase();
        }

        // Fallback to email
        return loginUser.email[0].toUpperCase();
    };

    const gotoDocumentation = () => {
        setIsMenuOpen(false);
        const systemApp = getSystemApps().find((app: SystemApp) => app.path === `/${pathFirstPart}`);
        const docsUrl = systemApp?.docsUrl || "/docs";
        const openUrl = `${process.env.NEXT_PUBLIC_DOCS_URL}${docsUrl}`;
        window.open(openUrl, "_blank");
    };

    return (
        <div className="relative">
            <button
                ref={avatarRef}
                onClick={handleMenuClick}
                className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium hover:opacity-80 transition-opacity"
                data-testid="app-header-user-avatar"
                title={loginUser?.email || ""}
            >
                {getUserInitials()}
            </button>

            {isMenuOpen && (
                <ContextMenu
                    x={menuPosition.x}
                    y={menuPosition.y}
                    onClose={() => setIsMenuOpen(false)}
                >
                    <div className="min-w-[200px] py-1">
                        {/* User info section */}
                        <div className="px-3 py-2 border-b border-border">
                            <p className="text-sm font-medium text-foreground">
                                {loginUser?.name || loginUser?.email}
                            </p>
                            {loginUser?.name && (
                                <p className="text-xs text-muted-foreground truncate">
                                    {loginUser.email}
                                </p>
                            )}
                        </div>

                        {/* Organization Switcher - Mobile only */}
                        {onOpenSettings && onOpenCreateDialog && (
                            <div className="md:hidden py-1 border-b border-border">
                                <div className="px-3 py-2">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">
                                        {t("org")}
                                    </p>
                                    {organizations.map((orgItem) => (
                                        <div
                                            key={orgItem.id}
                                            className="flex items-center group"
                                            data-testid={`mobile-org-option-wrapper-${orgItem.id}`}
                                        >
                                            <button
                                                onClick={() =>
                                                    handleOrgSelect(orgItem)
                                                }
                                                className={`flex-1 text-left px-2 py-1.5 text-sm hover:bg-accent transition-colors flex items-center gap-2 rounded-sm ${org?.id === orgItem.id
                                                    ? "bg-accent"
                                                    : ""
                                                    }`}
                                                data-testid={`mobile-org-option-${orgItem.id}`}
                                            >
                                                {orgItem.color && (
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                        style={{
                                                            backgroundColor:
                                                                orgItem.color,
                                                        }}
                                                        data-testid={`mobile-org-color-${orgItem.id}`}
                                                    />
                                                )}
                                                <span className="text-foreground truncate">
                                                    {orgItem.name}
                                                </span>
                                            </button>

                                        </div>
                                    ))}

                                </div>
                            </div>
                        )}

                        {/* Menu items */}
                        <div className="py-1">
                            {/* Theme toggle - Mobile only */}
                            <button
                                onClick={() => {
                                    toggleTheme();
                                    setIsMenuOpen(false);
                                    logEvent({
                                        eventType: "browse_header_theme_toggled",
                                        eventData: {
                                            theme: isDark ? "light" : "dark",
                                            source: "mobile_menu",
                                        },
                                    });
                                }}
                                className="md:hidden w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                                data-testid="app-header-theme-toggle-mobile"
                            >
                                {isDark ? (
                                    <Sun className="w-4 h-4" />
                                ) : (
                                    <Moon className="w-4 h-4" />
                                )}
                                {isDark ? t("switchToLightMode") : t("switchToDarkMode")}
                            </button>

                            <button
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    setIsContactUsDialogOpen(true);
                                    logEvent({
                                        eventType: "browse_header_contact_us_clicked",
                                    });
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                                data-testid="app-header-contact-us-btn"
                            >
                                <MessageSquare className="w-4 h-4" />
                                {t("contactUs")}
                            </button>

                            <button
                                onClick={() => {
                                    logEvent({
                                        eventType: "browse_header_docs_clicked",
                                    });
                                    gotoDocumentation();
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                                data-testid="app-header-docs-btn"
                            >
                                <Book className="w-4 h-4" />
                                {t("documentation")}
                            </button>


                            {/* doc-ai: hidden when no logout handler is given (single local user) */}
                            {onLogout && (
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        onLogout();
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                                    data-testid="app-header-logout-btn"
                                >
                                    <LogOut className="w-4 h-4" />
                                    {t("logout")}
                                </button>
                            )}
                        </div>
                    </div>
                </ContextMenu>
            )}

            <ContactUsDialog
                open={isContactUsDialogOpen}
                onOpenChange={setIsContactUsDialogOpen}
            />

            <ProfileDialog
                open={isProfileDialogOpen}
                onOpenChange={setIsProfileDialogOpen}
            />
        </div>
    );
}
