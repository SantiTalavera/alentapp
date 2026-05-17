import { createBrowserRouter } from "react-router";

import { MembersView } from "./views/Members";
import { HomeView } from "./views/Home";
import { SportsView } from "./views/Sports";
import { EnrollmentsView } from "./views/Enrollments";
import { PaymentsView } from "./views/Payments";
import Layout from "./Layout";

export let router = createBrowserRouter([
  {
    Component: Layout,
    children: [
      {
        path: "/",
        Component: HomeView,
      },
      {
        path: "/members",
        Component: MembersView,
      },
      {
        path: "/sports",
        Component: SportsView,
      },
      {
        path: "/enrollments",
        Component: EnrollmentsView,
      },
      {
        path: "/payments",
        Component: PaymentsView,
      },
    ],
  },
]);
