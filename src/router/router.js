import { createRouter, createWebHistory } from 'vue-router'
import { authGuard, adminGuard, adminOrStaffGuard } from '../middleware/auth'

import LoginView from '../views/LoginView.vue'
import HomeView from '../views/HomeView.vue'
import ScannerView from '../views/qrcode/ScannerView.vue'
import HistoryView from '../views/qrcode/HistoryView.vue'
import UserView from '../views/admin/UserView.vue'
import TicketView from '../views/admin/TicketView.vue'
import EventView from '../views/admin/EventView.vue'
import NotFound from '../views/NotFound.vue'

const routes = [
    {
        path: '/',
        name: 'home',
        component: HomeView,
        meta: { sidebar: true, requiresAuth: true },
        beforeEnter: authGuard
    },
    {
        path: '/login',
        name: 'login',
        component: LoginView,
        meta: { sidebar: false }
    },
    {
        path: '/qrcode',
        name: 'scanner',
        component: ScannerView,
        meta: { sidebar: true, requiresAuth: true },
        beforeEnter: authGuard
    },
    {
        path: '/qrcode/history',
        name: 'history',
        component: HistoryView,
        meta: { sidebar: true, requiresAuth: true },
        beforeEnter: authGuard
    },
    {
        path: '/admin/events',
        name: 'admin-events',
        component: EventView,
        meta: { sidebar: true, requiresAuth: true, requiresAdmin: true },
        beforeEnter: adminGuard
    },
    {
        path: '/admin/user',
        name: 'admin-users',
        component: UserView,
        meta: { sidebar: true, requiresAuth: true, requiresAdmin: true },
        beforeEnter: adminGuard
    },
    {
        path: '/admin/ticket',
        name: 'admin-tickets',
        component: TicketView,
        meta: { sidebar: true, requiresAuth: true },
        beforeEnter: adminOrStaffGuard
    },
    // 404 NotFound - Must be the last route
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: NotFound,
        meta: { sidebar: false }
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(to, from, savedPosition) {
        if (savedPosition) {
            return savedPosition
        } else {
            return { top: 0 }
        }
    }
})

export default router