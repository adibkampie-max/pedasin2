// ======================================================
// PEDASIN - CUSTOMER ↔ ADMIN REALTIME CHAT
// app.js
// ======================================================

const SUPABASE_URL = "MASUKKAN_SUPABASE_URL";
const SUPABASE_KEY = "MASUKKAN_PUBLISHABLE_KEY";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// ======================================================
// STATE
// ======================================================

let currentUser = null;
let currentConversation = null;
let realtimeChannel = null;

// ======================================================
// CEK LOGIN
// ======================================================

async function checkLogin() {
    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error) {
        console.error(error);
        return null;
    }

    currentUser = user;
    return user;
}

// ======================================================
// REGISTER CUSTOMER
// ======================================================

async function registerCustomer(email, password) {

    const { data, error } =
        await supabaseClient.auth.signUp({
            email: email,
            password: password
        });

    if (error) {
        alert(error.message);
        return null;
    }

    alert(
        "Akun berhasil dibuat. Silakan login."
    );

    return data.user;
}

// ======================================================
// LOGIN
// ======================================================

async function loginUser(email, password) {

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

    if (error) {
        alert(error.message);
        return null;
    }

    currentUser = data.user;

    console.log(
        "Login berhasil:",
        currentUser.email
    );

    return currentUser;
}

// ======================================================
// LOGOUT
// ======================================================

async function logoutUser() {

    const { error } =
        await supabaseClient.auth.signOut();

    if (error) {
        alert(error.message);
        return;
    }

    currentUser = null;
    currentConversation = null;

    if (realtimeChannel) {
        await supabaseClient.removeChannel(
            realtimeChannel
        );
        realtimeChannel = null;
    }

    location.reload();
}

// ======================================================
// BUAT CONVERSATION CUSTOMER
// ======================================================

async function createConversation(customerName) {

    if (!currentUser) {
        alert("Silakan login terlebih dahulu.");
        return null;
    }

    // Cek apakah customer sudah punya conversation
    const { data: existing, error: findError } =
        await supabaseClient
            .from("conversations")
            .select("*")
            .eq("customer_id", currentUser.id)
            .limit(1)
            .maybeSingle();

    if (findError) {
        console.error(findError);
        alert(findError.message);
        return null;
    }

    if (existing) {
        currentConversation = existing;
        return existing;
    }

    // Buat conversation baru
    const { data, error } =
        await supabaseClient
            .from("conversations")
            .insert({
                customer_id: currentUser.id,
                customer_name: customerName
            })
            .select()
            .single();

    if (error) {
        console.error(error);
        alert(error.message);
        return null;
    }

    currentConversation = data;

    return data;
}

// ======================================================
// KIRIM PESAN CUSTOMER
// ======================================================

async function sendCustomerMessage(message) {

    if (!currentUser) {
        alert("Silakan login.");
        return;
    }

    if (!currentConversation) {
        alert("Conversation belum dibuat.");
        return;
    }

    message = message.trim();

    if (!message) {
        return;
    }

    const { error } =
        await supabaseClient
            .from("messages")
            .insert({
                conversation_id:
                    currentConversation.id,

                sender_id:
                    currentUser.id,

                sender_role:
                    "customer",

                body:
                    message
            });

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    document.getElementById("messageInput").value = "";
}

// ======================================================
// AMBIL PESAN
// ======================================================

async function loadMessages() {

    if (!currentConversation) {
        return;
    }

    const { data, error } =
        await supabaseClient
            .from("messages")
            .select("*")
            .eq(
                "conversation_id",
                currentConversation.id
            )
            .order("created_at", {
                ascending: true
            });

    if (error) {
        console.error(error);
        return;
    }

    const chatBox =
        document.getElementById("chatMessages");

    if (!chatBox) return;

    chatBox.innerHTML = "";

    data.forEach(message => {

        addMessageToScreen(message);

    });
}

// ======================================================
// TAMPILKAN PESAN
// ======================================================

function addMessageToScreen(message) {

    const chatBox =
        document.getElementById("chatMessages");

    if (!chatBox) return;

    const div =
        document.createElement("div");

    div.className =
        message.sender_role === "customer"
            ? "message customer"
            : "message admin";

    div.textContent =
        message.body;

    chatBox.appendChild(div);

    chatBox.scrollTop =
        chatBox.scrollHeight;
}

// ======================================================
// REALTIME CHAT
// ======================================================

function startRealtimeChat() {

    if (!currentConversation) {
        return;
    }

    // Hapus channel lama
    if (realtimeChannel) {

        supabaseClient.removeChannel(
            realtimeChannel
        );

    }

    realtimeChannel =
        supabaseClient
            .channel(
                "chat-" +
                currentConversation.id
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter:
                        "conversation_id=eq." +
                        currentConversation.id
                },
                payload => {

                    console.log(
                        "Pesan baru:",
                        payload.new
                    );

                    addMessageToScreen(
                        payload.new
                    );

                }
            )
            .subscribe(status => {

                console.log(
                    "Realtime:",
                    status
                );

            });
}

// ======================================================
// MULAI CHAT CUSTOMER
// ======================================================

async function startCustomerChat(
    customerName
) {

    await checkLogin();

    if (!currentUser) {

        alert(
            "Customer harus login terlebih dahulu."
        );

        return;
    }

    const conversation =
        await createConversation(
            customerName
        );

    if (!conversation) {
        return;
    }

    currentConversation =
        conversation;

    await loadMessages();

    startRealtimeChat();

    console.log(
        "Chat customer aktif"
    );
}

// ======================================================
// CEK APAKAH USER ADMIN
// ======================================================

async function isAdmin() {

    if (!currentUser) {
        return false;
    }

    const { data, error } =
        await supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .maybeSingle();

    if (error) {
        console.error(error);
        return false;
    }

    return data?.role === "admin";
}

// ======================================================
// ADMIN - AMBIL SEMUA CHAT
// ======================================================

async function loadAdminConversations() {

    if (!currentUser) {
        return [];
    }

    if (!(await isAdmin())) {

        alert(
            "Akun ini bukan admin."
        );

        return [];
    }

    const { data, error } =
        await supabaseClient
            .from("conversations")
            .select("*")
            .order("updated_at", {
                ascending: false
            });

    if (error) {

        console.error(error);
        alert(error.message);

        return [];

    }

    return data || [];
}

// ======================================================
// ADMIN - BUKA CHAT CUSTOMER
// ======================================================

async function openAdminConversation(
    conversationId
) {

    if (!(await isAdmin())) {

        alert(
            "Akses admin diperlukan."
        );

        return;

    }

    const { data, error } =
        await supabaseClient
            .from("conversations")
            .select("*")
            .eq("id", conversationId)
            .single();

    if (error) {

        console.error(error);
        return;

    }

    currentConversation =
        data;

    await loadMessages();

    startRealtimeChat();

}

// ======================================================
// ADMIN - KIRIM PESAN
// ======================================================

async function sendAdminMessage(message) {

    if (!currentUser) {

        alert(
            "Silakan login sebagai admin."
        );

        return;

    }

    if (!(await isAdmin())) {

        alert(
            "Akun bukan admin."
        );

        return;

    }

    if (!currentConversation) {

        alert(
            "Pilih chat customer terlebih dahulu."
        );

        return;

    }

    message =
        message.trim();

    if (!message) {
        return;
    }

    const { error } =
        await supabaseClient
            .from("messages")
            .insert({

                conversation_id:
                    currentConversation.id,

                sender_id:
                    currentUser.id,

                sender_role:
                    "admin",

                body:
                    message

            });

    if (error) {

        console.error(error);
        alert(error.message);

        return;

    }

    const input =
        document.getElementById(
            "messageInput"
        );

    if (input) {
        input.value = "";
    }
}

// ======================================================
// EVENT FORM CHAT
// ======================================================

function setupChatForm() {

    const form =
        document.getElementById(
            "chatForm"
        );

    if (!form) return;

    form.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();

            const input =
                document.getElementById(
                    "messageInput"
                );

            if (!input) return;

            const message =
                input.value.trim();

            if (!message) return;

            if (await isAdmin()) {

                await sendAdminMessage(
                    message
                );

            } else {

                await sendCustomerMessage(
                    message
                );

            }

        }
    );
}

// ======================================================
// AUTH STATE
// ======================================================

supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

        console.log(
            "Auth:",
            event
        );

        currentUser =
            session?.user || null;

    }
);

// ======================================================
// START
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await checkLogin();

        setupChatForm();

        console.log(
            "PEDASIN Chat siap."
        );

    }
);
