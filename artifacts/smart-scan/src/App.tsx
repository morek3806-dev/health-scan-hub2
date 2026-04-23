import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Inventory from "@/pages/inventory";
import Scan from "@/pages/scan";
import Review from "@/pages/review";
import BatchDetail from "@/pages/batch-detail";
import POS from "@/pages/pos";
import Sales from "@/pages/sales";
import SaleDetail from "@/pages/sale-detail";
import MedicineDetail from "@/pages/medicine-detail";
import Suppliers from "@/pages/suppliers";
import SupplierNew from "@/pages/supplier-new";
import SupplierDetail from "@/pages/supplier-detail";
import Customers from "@/pages/customers";
import CustomerNew from "@/pages/customer-new";
import CustomerDetail from "@/pages/customer-detail";
import Doctors from "@/pages/doctors";
import DoctorNew from "@/pages/doctor-new";
import Insights from "@/pages/insights";
import Alerts from "@/pages/alerts";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/stock" component={Inventory} />
        <Route path="/scan" component={Scan} />
        <Route path="/scan/review" component={Review} />
        <Route path="/batch/:id" component={BatchDetail} />
        <Route path="/pos" component={POS} />
        <Route path="/sales" component={Sales} />
        <Route path="/sales/:id" component={SaleDetail} />
        <Route path="/medicines/:id" component={MedicineDetail} />
        <Route path="/suppliers" component={Suppliers} />
        <Route path="/suppliers/new" component={SupplierNew} />
        <Route path="/suppliers/:id" component={SupplierDetail} />
        <Route path="/customers" component={Customers} />
        <Route path="/customers/new" component={CustomerNew} />
        <Route path="/customers/:id" component={CustomerDetail} />
        <Route path="/doctors" component={Doctors} />
        <Route path="/doctors/new" component={DoctorNew} />
        <Route path="/insights" component={Insights} />
        <Route path="/alerts" component={Alerts} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
