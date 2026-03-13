import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Audit from "./pages/Audit";
import Packs from "./pages/Packs";
import About from "./pages/About";
import Book from "./pages/Book";
import Team from "./pages/Team";
import Services from "./pages/Services";
import Contact from "./pages/Contact";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import CheckoutCancel from "./pages/CheckoutCancel";
import Layout from "./components/Layout";
import Portal from "./pages/Portal";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/audit"} component={Audit} />
        <Route path={"/packs"} component={Packs} />
        <Route path={"/services"} component={Services} />
        <Route path={"/about"} component={About} />
        <Route path={"/team"} component={Team} />
        <Route path={"/book"} component={Book} />
        <Route path={"/contact"} component={Contact} />
        <Route path={"/portal"} component={Portal} />
        <Route path={"/checkout/success"} component={CheckoutSuccess} />
        <Route path={"/checkout/cancel"} component={CheckoutCancel} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
