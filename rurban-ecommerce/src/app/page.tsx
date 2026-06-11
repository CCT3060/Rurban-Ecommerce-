import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import HomePage from "./(shop)/page";
import { getInitialUser } from "@/lib/auth/get-initial-user";

export default async function RootHomePage() {
	const initialUser = await getInitialUser();
	return (
		<>
			<Navbar initialUser={initialUser} />
			<main className="flex-1">
				<HomePage />
			</main>
			<Footer />
		</>
	);
}
