import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import {
	getAllScriptIds,
	getScriptById,
	getScriptsByPlatform,
} from "../../../lib/loadScripts";
import type { ScriptEntry } from "../../../lib/types";

const VALID_PLATFORMS = ["windows", "linux", "mac"] as const;
type Platform = (typeof VALID_PLATFORMS)[number];

// ---------------------------------------------------------------------------
// generateStaticParams: emit paths for all platforms + all script ids
// ---------------------------------------------------------------------------

export async function generateStaticParams() {
	const scriptIds = await getAllScriptIds();
	const platformParams = VALID_PLATFORMS.map((p) => ({ slug: p }));
	const idParams = scriptIds.map((id) => ({ slug: id }));
	return [...platformParams, ...idParams];
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function ArchBadge({ arch }: { arch: string }) {
	return (
		<span
			data-testid="arch-badge"
			className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
		>
			{arch}
		</span>
	);
}

// ---------------------------------------------------------------------------
// Platform listing components
// ---------------------------------------------------------------------------

const PLATFORM_LABELS: Record<Platform, string> = {
	windows: "Windows",
	linux: "Linux",
	mac: "macOS",
};

function ScriptItem({ entry }: { entry: ScriptEntry }) {
	return (
		<div
			data-testid="script-entry"
			className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
		>
			<div className="min-w-0 flex-1">
				<Link
					href={`/scripts/${entry.id}`}
					className="text-base font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
				>
					{entry.name}
				</Link>
				<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
					{entry.description}
				</p>
			</div>
			<ArchBadge arch={entry.arch} />
		</div>
	);
}

function FlatList({ entries }: { entries: ScriptEntry[] }) {
	const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
	return (
		<div className="flex flex-col gap-3">
			{sorted.map((entry) => (
				<ScriptItem key={entry.id} entry={entry} />
			))}
		</div>
	);
}

function LinuxGroupedList({ entries }: { entries: ScriptEntry[] }) {
	const groups = new Map<string, ScriptEntry[]>();
	for (const entry of entries) {
		const distro = entry.distro ?? "Other";
		if (!groups.has(distro)) {
			groups.set(distro, []);
		}
		groups.get(distro)?.push(entry);
	}

	const sortedDistros = [...groups.keys()].sort((a, b) => a.localeCompare(b));

	return (
		<div className="flex flex-col gap-8">
			{sortedDistros.map((distro) => {
				const distroEntries = (groups.get(distro) ?? []).sort((a, b) =>
					a.name.localeCompare(b.name),
				);
				return (
					<section key={distro}>
						<h2
							data-testid="distro-heading"
							className="mb-3 text-lg font-semibold text-zinc-700 dark:text-zinc-300"
						>
							{distro}
						</h2>
						<div className="flex flex-col gap-3">
							{distroEntries.map((entry) => (
								<ScriptItem key={entry.id} entry={entry} />
							))}
						</div>
					</section>
				);
			})}
		</div>
	);
}

async function PlatformListingPage({ platform }: { platform: Platform }) {
	const scripts = await getScriptsByPlatform(platform);
	const label = PLATFORM_LABELS[platform];

	return (
		<div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
			<main className="mx-auto max-w-4xl px-6 py-16">
				<div className="mb-10">
					<Link
						href="/"
						className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
					>
						← Home
					</Link>
					<h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
						{label} Scripts
					</h1>
					<p className="mt-2 text-zinc-600 dark:text-zinc-400">
						{scripts.length} script{scripts.length !== 1 ? "s" : ""} available
					</p>
				</div>

				{platform === "linux" ? (
					<LinuxGroupedList entries={scripts} />
				) : (
					<FlatList entries={scripts} />
				)}
			</main>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Script detail page
// ---------------------------------------------------------------------------

function ScriptDetailContent({ entry }: { entry: ScriptEntry }) {
	const platformLabel =
		entry.platform === "mac"
			? "macOS"
			: entry.platform.charAt(0).toUpperCase() + entry.platform.slice(1);

	return (
		<div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
			<main className="mx-auto max-w-4xl px-6 py-16">
				{/* Breadcrumb navigation */}
				<nav className="mb-8 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
					<Link href="/" className="hover:underline">
						Home
					</Link>
					<span>/</span>
					<Link href={`/scripts/${entry.platform}`} className="hover:underline">
						{platformLabel}
					</Link>
					<span>/</span>
					<span className="text-zinc-700 dark:text-zinc-300">{entry.name}</span>
				</nav>

				{/* Header */}
				<div className="mb-8">
					<div className="mb-3 flex flex-wrap items-start gap-3">
						<h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
							{entry.name}
						</h1>
						<ArchBadge arch={entry.arch} />
					</div>
					<p className="text-lg text-zinc-600 dark:text-zinc-400">
						{entry.description}
					</p>
				</div>

				{/* Metadata table */}
				<div className="mb-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
					<h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
						Metadata
					</h2>
					<dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div>
							<dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
								Platform
							</dt>
							<dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">
								{platformLabel}
							</dd>
						</div>
						<div>
							<dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
								Architecture
							</dt>
							<dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">
								{entry.arch}
							</dd>
						</div>
						{entry.distro && (
							<div>
								<dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
									Distribution
								</dt>
								<dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">
									{entry.distro}
									{entry.version ? ` ${entry.version}` : ""}
								</dd>
							</div>
						)}
					</dl>
				</div>

				{/* Dependencies */}
				{entry.dependencies && entry.dependencies.length > 0 && (
					<div className="mb-8">
						<h2 className="mb-3 text-lg font-semibold text-zinc-700 dark:text-zinc-300">
							Dependencies
						</h2>
						<ul className="flex flex-col gap-2">
							{entry.dependencies.map((depId) => (
								<li key={depId}>
									<Link
										href={`/scripts/${depId}`}
										data-testid="dependency-link"
										className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
									>
										{depId}
									</Link>
								</li>
							))}
						</ul>
					</div>
				)}

				{/* Spec / markdown content */}
				{entry.spec && (
					<div className="mb-8">
						<h2 className="mb-4 text-lg font-semibold text-zinc-700 dark:text-zinc-300">
							Specification
						</h2>
						<div
							data-testid="spec-content"
							className="prose prose-zinc max-w-none rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 dark:prose-invert"
						>
							<ReactMarkdown rehypePlugins={[rehypeHighlight]}>
								{entry.spec}
							</ReactMarkdown>
						</div>
					</div>
				)}
			</main>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Unified page component — dispatches on slug type
// ---------------------------------------------------------------------------

interface PageProps {
	params: Promise<{ slug: string }>;
}

export default async function ScriptsSlugPage({ params }: PageProps) {
	const { slug } = await params;

	// If slug is a known platform, render the platform listing
	if (VALID_PLATFORMS.includes(slug as Platform)) {
		return <PlatformListingPage platform={slug as Platform} />;
	}

	// Otherwise look up the script by id
	const entry = await getScriptById(slug);
	if (!entry) {
		notFound();
	}

	return <ScriptDetailContent entry={entry} />;
}
