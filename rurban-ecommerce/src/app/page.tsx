import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import HomePage from "./(shop)/page";

export default function RootHomePage() {
	return (
		<>
			<Navbar />
			<main className="flex-1">
				<HomePage />
			</main>
			<Footer />
		</>
	);
}
