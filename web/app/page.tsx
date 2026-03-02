import Link from "next/link";
import InstallCommand from "./components/InstallCommand";

export default function Home() {
	return (
		<div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
			<main className="mx-auto max-w-5xl px-6 py-20">
				{/* Hero Section */}
				<section className="mb-16 text-center">
					<h1 className="mb-4 text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
						Scriptor
					</h1>
					<p className="mx-auto mb-8 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
						Run host-specific setup scripts from a GitHub repository — tailored
						to your OS, architecture, and distribution.
					</p>
					<div data-testid="install-command" className="mx-auto max-w-2xl">
						<InstallCommand />
					</div>
				</section>

				{/* Platform Navigation Cards */}
				<section>
					<h2 className="mb-8 text-center text-xl font-semibold text-zinc-700 dark:text-zinc-300">
						Browse scripts by platform
					</h2>
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
						<Link
							href="/scripts/windows"
							data-testid="platform-card-windows"
							className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
						>
							<span className="text-4xl">🪟</span>
							<span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
								Windows
							</span>
							<span className="text-sm text-zinc-500 dark:text-zinc-400">
								PowerShell setup scripts
							</span>
						</Link>

						<Link
							href="/scripts/linux"
							data-testid="platform-card-linux"
							className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
						>
							<span className="text-4xl">🐧</span>
							<span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
								Linux
							</span>
							<span className="text-sm text-zinc-500 dark:text-zinc-400">
								Bash scripts by distro
							</span>
						</Link>

						<Link
							href="/scripts/mac"
							data-testid="platform-card-mac"
							className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
						>
							<span className="text-4xl">🍎</span>
							<span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
								macOS
							</span>
							<span className="text-sm text-zinc-500 dark:text-zinc-400">
								Homebrew & shell scripts
							</span>
						</Link>
					</div>
				</section>
			</main>
		</div>
	);
}
