// ======================================================
// PEDASIN CHAT
// app.js
// ======================================================


// ======================================================
// SUPABASE CONFIG
// ======================================================

const SUPABASE_URL = "MASUKKAN_PROJECT_URL";

const SUPABASE_KEY = "MASUKKAN_PUBLISHABLE_KEY";


const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


// ======================================================
// STATE
// ======================================================

let currentUser = null;

let currentProfile = null;

let currentConversation = null;

let realtimeChannel = null;

let adminConversationChannel = null;


// ======================================================
// ELEMENT
// ======================================================

const authSection =
    document.getElementById("authSection");

const customerSection =
    document.getElementById("customerSection");

const adminSection =
    document.getElementById("adminSection");

const userEmail =
    document.getElementById("userEmail");

const logoutBtn =
    document.getElementById("logoutBtn");


// ======================================================
// TOAST
// ======================================================

function showToast(message) {

    const toast =
        document.getElementById("toast");

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);
}


// ======================================================
// LOADING
// ======================================================

function setLoading(status) {

    document.getElementById(
        "loading"
    ).style.display =
        status ? "flex" : "none";
}


// ======================================================
// LOGIN / REGISTER SWITCH
// ======================================================

function showRegister() {

    document.getElementById(
        "loginBox"
    ).style.display = "none";

    document.getElementById(
        "registerBox"
    ).style.display = "block";
}


function showLogin() {

    document.getElementById(
        "registerBox"
    ).style.display = "none";

    document.getElementById(
        "loginBox"
    ).style.display = "block";
}


// ======================================================
// REGISTER
// ======================================================

async function handleRegister() {

    const name =
        document.getElementById(
            "registerName"
        ).value.trim();

    const email =
        document.getElementById(
            "registerEmail"
        ).value.trim();

    const password =
        document.getElementById(
            "registerPassword"
        ).value;


    if (!name) {

        showToast(
            "Masukkan nama kamu."
        );

        return;
    }


    if (!email) {

        showToast(
            "Masukkan email."
        );

        return;
    }


    if (password.length < 6) {

        showToast(
            "Password minimal 6 karakter."
        );

        return;
    }


    setLoading(true);


    const {
        data,
        error
    } =
        await supabaseClient.auth.signUp({

            email: email,

            password: password,

            options: {

                data: {
                    full_name: name
                }

            }

        });


    setLoading(false);


    if (error) {

        console.error(error);

        showToast(
            error.message
        );

        return;
    }


    showToast(
        "Akun berhasil dibuat."
    );


    if (data.session) {

        await loadApplication();

    } else {

        showToast(
            "Cek email untuk konfirmasi akun."
        );

        showLogin();

    }
}


// ======================================================
// LOGIN
// ======================================================

async function handleLogin() {

    const email =
        document.getElementById(
            "loginEmail"
        ).value.trim();

    const password =
        document.getElementById(
            "loginPassword"
        ).value;


    if (!email || !password) {

        showToast(
            "Email dan password wajib diisi."
        );

        return;
    }


    setLoading(true);


    const {
        data,
        error
    } =
        await supabaseClient.auth
            .signInWithPassword({

                email: email,

                password: password

            });


    setLoading(false);


    if (error) {

        console.error(error);

        showToast(
            error.message
        );

        return;
    }


    currentUser =
        data.user;


    await loadApplication();
}


// ======================================================
// LOGOUT
// ======================================================

async function logoutUser() {

    if (realtimeChannel) {

        await supabaseClient
            .removeChannel(
                realtimeChannel
            );

        realtimeChannel = null;
    }


    if (adminConversationChannel) {

        await supabaseClient
            .removeChannel(
                adminConversationChannel
            );

        adminConversationChannel = null;
    }


    await supabaseClient.auth.signOut();


    currentUser = null;

    currentProfile = null;

    currentConversation = null;


    customerSection.style.display =
        "none";

    adminSection.style.display =
        "none";

    authSection.style.display =
        "flex";

    logoutBtn.style.display =
        "none";

    userEmail.textContent =
        "Belum login";


    showToast(
        "Berhasil logout."
    );
}


// ======================================================
// LOAD PROFILE
// ======================================================

async function loadProfile() {

    if (!currentUser) {
        return null;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("profiles")
            .select("*")
            .eq(
                "id",
                currentUser.id
            )
            .maybeSingle();


    if (error) {

        console.error(error);

        return null;
    }


    currentProfile = data;

    return data;
}


// ======================================================
// LOAD APPLICATION
// ======================================================

async function loadApplication() {

    setLoading(true);


    await loadProfile();


    authSection.style.display =
        "none";


    logoutBtn.style.display =
        "inline-block";


    userEmail.textContent =
        currentUser.email;


    if (
        currentProfile &&
        currentProfile.role === "admin"
    ) {

        customerSection.style.display =
            "none";

        adminSection.style.display =
            "block";


        await loadAdminConversations();

        startAdminRealtime();

    } else {

        adminSection.style.display =
            "none";

        customerSection.style.display =
            "block";


        await startCustomerChat();

    }


    setLoading(false);
}


// ======================================================
// CUSTOMER CHAT
// ======================================================

async function startCustomerChat() {

    if (!currentUser) {
        return;
    }


    // Cari conversation customer
    const {
        data,
        error
    } =
        await supabaseClient
            .from("conversations")
            .select("*")
            .eq(
                "customer_id",
                currentUser.id
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(1)
            .maybeSingle();


    if (error) {

        console.error(error);

        showToast(
            "Gagal mengambil chat."
        );

        return;
    }


    if (data) {

        currentConversation =
            data;

    } else {

        // Ambil nama dari metadata
        const customerName =
            currentUser.user_metadata
                ?.full_name ||
            "Customer";


        const {
            data: newConversation,
            error: createError
        } =
            await supabaseClient
                .from("conversations")
                .insert({

                    customer_id:
                        currentUser.id,

                    customer_name:
                        customerName

                })
                .select()
                .single();


        if (createError) {

            console.error(
                createError
            );

            showToast(
                "Gagal membuat chat."
            );

            return;
        }


        currentConversation =
            newConversation;
    }


    await loadCustomerMessages();

    startCustomerRealtime();
}


// ======================================================
// LOAD CUSTOMER MESSAGES
// ======================================================

async function loadCustomerMessages() {

    if (!currentConversation) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("messages")
            .select("*")
            .eq(
                "conversation_id",
                currentConversation.id
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(error);

        return;
    }


    const box =
        document.getElementById(
            "customerMessages"
        );


    box.innerHTML = "";


    if (!data || data.length === 0) {

        box.innerHTML = `
            <div class="empty-chat">
                Belum ada pesan.<br>
                Silakan mulai chat dengan Admin.
            </div>
        `;

        return;
    }


    data.forEach(
        message => {

            addCustomerMessage(
                message
            );

        }
    );
}


// ======================================================
// DISPLAY CUSTOMER MESSAGE
// ======================================================

function addCustomerMessage(message) {

    const box =
        document.getElementById(
            "customerMessages"
        );


    const div =
        document.createElement(
            "div"
        );


    div.className =
        message.sender_role === "customer"
            ? "message customer"
            : "message admin";


    div.textContent =
        message.body;


    box.appendChild(div);


    box.scrollTop =
        box.scrollHeight;
}


// ======================================================
// SEND CUSTOMER MESSAGE
// ======================================================

async function sendCustomerMessage(
    message
) {

    if (!currentUser ||
        !currentConversation) {

        return;
    }


    message =
        message.trim();


    if (!message) {
        return;
    }


    const {
        error
    } =
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

        showToast(
            error.message
        );

        return;
    }


    document.getElementById(
        "customerInput"
    ).value = "";
}


// ======================================================
// CUSTOMER REALTIME
// ======================================================

function startCustomerRealtime() {

    if (!currentConversation) {
        return;
    }


    if (realtimeChannel) {

        supabaseClient
            .removeChannel(
                realtimeChannel
            );

    }


    realtimeChannel =
        supabaseClient
            .channel(
                "customer-chat-" +
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

                    addCustomerMessage(
                        payload.new
                    );

                }

            )
            .subscribe(
                status => {

                    console.log(
                        "Customer realtime:",
                        status
                    );

                }
            );
}


// ======================================================
// ADMIN CONVERSATIONS
// ======================================================

async function loadAdminConversations() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("conversations")
            .select("*")
            .order(
                "updated_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(error);

        showToast(
            error.message
        );

        return;
    }


    const list =
        document.getElementById(
            "conversationList"
        );


    list.innerHTML = "";


    const count =
        document.getElementById(
            "customerCount"
        );


    count.textContent =
        `${data.length} chat`;


    if (data.length === 0) {

        list.innerHTML = `
            <div class="empty-list">
                Belum ada customer.
            </div>
        `;

        return;
    }


    data.forEach(
        conversation => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "conversation-item";


            item.dataset.id =
                conversation.id;


            item.innerHTML = `

                <div class="conversation-name">

                    👤
                    ${escapeHTML(
                        conversation.customer_name ||
                        "Customer"
                    )}

                </div>

                <div class="conversation-email">

                    Customer ID:
                    ${conversation.customer_id}

                </div>

            `;


            item.onclick =
                () => {

                    openAdminConversation(
                        conversation
                    );

                };


            list.appendChild(item);

        }
    );
}


// ======================================================
// OPEN ADMIN CHAT
// ======================================================

async function openAdminConversation(
    conversation
) {

    currentConversation =
        conversation;


    document
        .querySelectorAll(
            ".conversation-item"
        )
        .forEach(
            item => {

                item.classList.remove(
                    "active"
                );

            }
        );


    const selected =
        document.querySelector(
            `[data-id="${conversation.id}"]`
        );


    if (selected) {

        selected.classList.add(
            "active"
        );

    }


    document.getElementById(
        "adminChatHeader"
    ).innerHTML = `

        <h2>
            💬
            ${escapeHTML(
                conversation.customer_name ||
                "Customer"
            )}
        </h2>

        <span class="online">
            ● Customer
        </span>

    `;


    document.getElementById(
        "adminInput"
    ).disabled = false;


    document.getElementById(
        "adminSendBtn"
    ).disabled = false;


    await loadAdminMessages();


    startAdminChatRealtime();
}


// ======================================================
// LOAD ADMIN MESSAGES
// ======================================================

async function loadAdminMessages() {

    if (!currentConversation) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("messages")
            .select("*")
            .eq(
                "conversation_id",
                currentConversation.id
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(error);

        return;
    }


    const box =
        document.getElementById(
            "adminMessages"
        );


    box.innerHTML = "";


    if (!data || data.length === 0) {

        box.innerHTML = `
            <div class="empty-chat">
                Belum ada pesan.
            </div>
        `;

        return;
    }


    data.forEach(
        message => {

            addAdminMessage(
                message
            );

        }
    );
}


// ======================================================
// DISPLAY ADMIN MESSAGE
// ======================================================

function addAdminMessage(message) {

    const box =
        document.getElementById(
            "adminMessages"
        );


    const div =
        document.createElement(
            "div"
        );


    div.className =
        message.sender_role === "admin"
            ? "message customer"
            : "message admin";


    div.textContent =
        message.body;


    box.appendChild(div);


    box.scrollTop =
        box.scrollHeight;
}


// ======================================================
// SEND ADMIN MESSAGE
// ======================================================

async function sendAdminMessage(
    message
) {

    if (!currentUser ||
        !currentConversation) {

        return;
    }


    message =
        message.trim();


    if (!message) {
        return;
    }


    const {
        error
    } =
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

        showToast(
            error.message
        );

        return;
    }


    document.getElementById(
        "adminInput"
    ).value = "";
}


// ======================================================
// ADMIN CHAT REALTIME
// ======================================================

function startAdminChatRealtime() {

    if (!currentConversation) {
        return;
    }


    if (adminConversationChannel) {

        supabaseClient
            .removeChannel(
                adminConversationChannel
            );

    }


    adminConversationChannel =
        supabaseClient
            .channel(
                "admin-chat-" +
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

                    addAdminMessage(
                        payload.new
                    );

                }

            )
            .subscribe();
}


// ======================================================
// ADMIN LIST REALTIME
// ======================================================

function startAdminRealtime() {

    if (realtimeChannel) {

        supabaseClient
            .removeChannel(
                realtimeChannel
            );

    }


    realtimeChannel =
        supabaseClient
            .channel(
                "admin-conversations"
            )
            .on(

                "postgres_changes",

                {

                    event: "*",

                    schema: "public",

                    table: "conversations"

                },

                async () => {

                    await loadAdminConversations();

                }

            )
            .subscribe();
}


// ======================================================
// HTML SECURITY
// ======================================================

function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text || "";

    return div.innerHTML;
}


// ======================================================
// CUSTOMER FORM
// ======================================================

document.getElementById(
    "customerForm"
).addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const input =
            document.getElementById(
                "customerInput"
            );


        await sendCustomerMessage(
            input.value
        );

    }
);


// ======================================================
// ADMIN FORM
// ======================================================

document.getElementById(
    "adminForm"
).addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const input =
            document.getElementById(
                "adminInput"
            );


        await sendAdminMessage(
            input.value
        );

    }
);


// ======================================================
// AUTH STATE
// ======================================================

supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

        console.log(
            "Auth event:",
            event
        );


        if (session?.user) {

            currentUser =
                session.user;

        }

    }
);


// ======================================================
// START APP
// ======================================================

async function startApp() {

    setLoading(true);


    const {
        data
    } =
        await supabaseClient.auth
            .getSession();


    if (data.session?.user) {

        currentUser =
            data.session.user;

        await loadApplication();

    } else {

        authSection.style.display =
            "flex";

    }


    setLoading(false);
}


startApp();
