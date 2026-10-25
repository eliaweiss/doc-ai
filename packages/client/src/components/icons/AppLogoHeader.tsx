"use client";


import LogoIcon from "./LogoIcon";
import { DocVisionLogo, OneFlowLogo } from "@zdocs/client-component";
import { isMobileWidth } from "@zdocs/util";
import useOrgStore from "../../context-providers/orgStore";
import { getTextColorForBackground } from "@zdocs/client-component";
import { IS_DOC_VISION } from "@zdocs/util";

type OneFlowLogoProps = {
    className?: string;
    size?: number;
    "data-testid"?: string;
};

export function AppLogoHeader({
    className,
    size = 24,
    "data-testid": testId = "oneflow-logo",
}: OneFlowLogoProps) {
    const { org } = useOrgStore();
    const isMobile = isMobileWidth();
    const bgColor = org?.color || '#ffffff';

    const textColor = org?.color
        ? getTextColorForBackground(org.color)
        : undefined;

    // if (IS_DOC_VISION) {
    return (
        <DocVisionLogo size={isMobile ? size + 10 : size} className={className} data-testid={testId} />
    );
    // }

    // if (isMobile) {
    //     return (
    //         <LogoIcon
    //             size={size + 10}
    //             className="rounded-lg"
    //             fill={bgColor}
    //             style={textColor ? { color: textColor } : undefined}
    //         />
    //     );
    // }

    // return (
    //     <OneFlowLogo size={size} className={className} data-testid={testId} backgroundColor={bgColor} />
    // );
}
