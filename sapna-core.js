/**
 * ============================================================================
 * ☁️ SAPNA JUICE CLOUD ENGINE V3.1 (Supabase Realtime WebSockets)
 * ============================================================================
 */

class SapnaCloudEngine {
    constructor() {
        // Aapki Nayi Tijori ke Fresh Credentials
        this.url = 'https://fydelsvviminmhchuyyn.supabase.co';
        this.key = 'sb_publishable_jkSLwwJt9oYhsFiAtT51FA_62mNsxeo';

        if (!window.supabase) {
            console.error("🚨 FATAL: Supabase SDK script tag missing in HTML!");
            return;
        }

        this.sb = window.supabase.createClient(this.url, this.key);

        this.cache = {
            shopName: "Sapna Juice & Restaurant",
            kitchens: [], categories: [], menu: [], tables: [], staff: [], activeOrders: []
        };

        this.bootCloud();
    }

    async bootCloud() {
        console.log("☁️ SapnaCore: Initiating Supabase Cloud Handshake...");
        await this.downloadEverything();
        this.attachRealtimeListener();
    }

    async downloadEverything() {
        let [kit, cat, men, tbl, stf, ord] = await Promise.all([
            this.sb.from('kitchens').select('*'),
            this.sb.from('categories').select('*'),
            this.sb.from('menu').select('*'),
            this.sb.from('tables').select('*'),
            this.sb.from('staff').select('*'),
            this.sb.from('active_orders').select('*')
        ]);

        this.cache.kitchens = kit.data || [];
        this.cache.categories = (cat.data || []).map(c => c.name);
        
        this.cache.menu = (men.data || []).map(m => ({
            id: m.id, name: m.name, category: m.category, price: m.price, kitchenId: m.kitchen_id
        }));

        this.cache.tables = (tbl.data || []).map(t => ({
            id: t.id, label: t.label, area: t.area, isParcel: t.is_parcel
        }));

        this.cache.staff = (stf.data || []).map(s => ({
            id: s.id, name: s.name, role: s.role, baseSalary: s.base_salary, advanceTaken: s.advance_taken, statusToday: s.status_today
        }));

        this.cache.activeOrders = (ord.data || []).map(o => ({
            orderId: o.order_id, tableId: o.table_id, type: o.type, customer: o.customer, timestamp: o.timestamp, items: o.items || []
        }));

        window.dispatchEvent(new CustomEvent('SAPNA_STATE_UPDATED', { detail: this.cache }));
    }

    get() { return this.cache; }

    async save(mutatedDb) {
        // 1. SMART GHOST DETECTOR: Jo ID pehle thi par ab nahi aayi, usey jadd se udao
        const oldMenuIds = this.cache.menu.map(m => m.id);
        const newMenuIds = mutatedDb.menu.map(m => m.id);
        const deadMenu = oldMenuIds.filter(id => !newMenuIds.includes(id));

        const oldCats = this.cache.categories;
        const newCats = mutatedDb.categories;
        const deadCats = oldCats.filter(c => !newCats.includes(c));

        const oldKits = this.cache.kitchens.map(k => k.id);
        const newKits = mutatedDb.kitchens.map(k => k.id);
        const deadKits = oldKits.filter(id => !newKits.includes(id));

        if (deadMenu.length > 0) await this.sb.from('menu').delete().in('id', deadMenu);
        if (deadCats.length > 0) await this.sb.from('categories').delete().in('name', deadCats);
        if (deadKits.length > 0) await this.sb.from('kitchens').delete().in('id', deadKits);

        // 2. Local State Update karo
        this.cache = mutatedDb; 
        window.dispatchEvent(new CustomEvent('SAPNA_STATE_UPDATED', { detail: this.cache }));

        // 3. Baaki zinda items ko normal Upsert karo
        await Promise.all([
            this.sb.from('kitchens').upsert(mutatedDb.kitchens.map(k => ({ id: k.id, name: k.name, icon: k.icon }))),
            this.sb.from('categories').upsert(mutatedDb.categories.map(c => ({ name: c }))),
            this.sb.from('menu').upsert(mutatedDb.menu.map(m => ({ id: m.id, name: m.name, category: m.category, price: m.price, kitchen_id: m.kitchenId }))),
            this.sb.from('tables').upsert(mutatedDb.tables.map(t => ({ id: t.id, label: t.label, area: t.area, is_parcel: t.isParcel }))),
            this.sb.from('staff').upsert(mutatedDb.staff.map(s => ({ id: s.id, name: s.name, role: s.role, base_salary: s.baseSalary, advance_taken: s.advanceTaken, status_today: s.statusToday })))
        ]);
    }

    // NAYA WEAPON: Direct table ke input box se price badalne ke liye
    async quickPriceUpdate(itemId, newPrice) {
        let num = parseFloat(newPrice);
        if(isNaN(num)) return;

        let obj = this.cache.menu.find(m => m.id === itemId);
        if(obj) {
            obj.price = num;
            window.dispatchEvent(new CustomEvent('SAPNA_STATE_UPDATED', { detail: this.cache }));
            await this.sb.from('menu').update({ price: num }).eq('id', itemId);
        }
    }

    async punchOrder(tableId, itemsArray, orderType = 'DINE_IN', customerInfo = { name: 'Walking Customer', phone: '' }) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let existing = this.cache.activeOrders.find(o => o.tableId === tableId);

        const newItems = itemsArray.map(i => ({
            ...i, uniqueTicketId: 'TKT_' + Math.random().toString(36).substr(2,6).toUpperCase(), status: 'PENDING', punchedTime: timeStr
        }));

        if (existing) {
            let merged = [...existing.items, ...newItems];
            existing.items = merged; window.dispatchEvent(new CustomEvent('SAPNA_STATE_UPDATED', { detail: this.cache }));
            await this.sb.from('active_orders').update({ items: merged }).eq('table_id', tableId);
        } else {
            let newOrd = {
                order_id: 'ORD_' + Math.random().toString(36).substr(2,5).toUpperCase(),
                table_id: tableId, type: orderType, customer: customerInfo, timestamp: timeStr, items: newItems
            };
            this.cache.activeOrders.push({ ...newOrd, orderId: newOrd.order_id, tableId: newOrd.table_id });
            window.dispatchEvent(new CustomEvent('SAPNA_STATE_UPDATED', { detail: this.cache }));
            await this.sb.from('active_orders').insert(newOrd);
        }
    }

    async updateKitchenItemStatus(orderId, tktId, newStatus) {
        let order = this.cache.activeOrders.find(o => o.orderId === orderId);
        if (order) {
            order.items.forEach(i => { if(i.uniqueTicketId === tktId) i.status = newStatus; });
            window.dispatchEvent(new CustomEvent('SAPNA_STATE_UPDATED', { detail: this.cache }));
            await this.sb.from('active_orders').update({ items: order.items }).eq('order_id', orderId);
        }
    }

    async settleAndClearTable(orderId) {
        this.cache.activeOrders = this.cache.activeOrders.filter(o => o.orderId !== orderId);
        window.dispatchEvent(new CustomEvent('SAPNA_STATE_UPDATED', { detail: this.cache }));
        await this.sb.from('active_orders').delete().eq('order_id', orderId);
    }

    async delKitchen(id) { await this.sb.from('kitchens').delete().eq('id', id); this.downloadEverything(); }
    async delTable(id) { await this.sb.from('tables').delete().eq('id', id); this.downloadEverything(); }
    async delMenu(id) { await this.sb.from('menu').delete().eq('id', id); this.downloadEverything(); }
    async delStaff(id) { await this.sb.from('staff').delete().eq('id', id); this.downloadEverything(); }
    async delCategory(name) { await this.sb.from('categories').delete().eq('name', name); this.downloadEverything(); }

    attachRealtimeListener() {
        this.sb.channel('pos-live-sync')
            .on('postgres_changes', { event: '*', schema: 'public' }, () => {
                this.downloadEverything(); 
            }).subscribe();
    }
}

window.Sapna = new SapnaCloudEngine();