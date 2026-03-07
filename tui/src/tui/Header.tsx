import { Box, Text } from "ink";
import type { HostInfo } from "../host/detectHost.js";

export interface HeaderProps {
	hostInfo: HostInfo;
	repoUrl: string;
}

/**
 * Persistent header bar showing detected host information and the active
 * repository URL.
 */
export function Header({ hostInfo, repoUrl }: HeaderProps) {
	const hostLabel = buildHostLabel(hostInfo);

	return (
		<Box
			borderStyle="single"
			borderBottom={true}
			borderTop={false}
			borderLeft={false}
			borderRight={false}
			paddingX={1}
			justifyContent="space-between"
		>
			<Text bold={true}>
				{"Scriptor "}
				<Text dimColor={true}>{hostLabel}</Text>
			</Text>
			<Text dimColor={true}>{repoUrl}</Text>
		</Box>
	);
}

function buildHostLabel(host: HostInfo): string {
	const parts: string[] = [host.platform, host.arch];
	if (host.platform === "linux" && host.distro !== undefined) {
		const distroVersion =
			host.version !== undefined
				? `${host.distro} ${host.version}`
				: host.distro;
		parts.push(distroVersion);
	}
	return `[${parts.join(" / ")}]`;
}
