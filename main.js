
/* =========================================
   BOOKFACE - APLICAÇÃO PRINCIPAL
   Armazenamento local para protótipo
========================================= */

const DB = {
    users: "bookface_users",
    posts: "bookface_posts",
    notifications: "bookface_notifications",
    messages: "bookface_messages",
    session: "bookface_session"
};

const read = (key, fallback = []) => {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value ?? fallback;
    } catch {
        return fallback;
    }
};

const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
};

let users = read(DB.users);
let posts = read(DB.posts);
let notifications = read(DB.notifications);
let messages = read(DB.messages);
let currentUser = null;
let currentPage = "home";
let authMode = "login";
let activeChat = null;
let selectedImage = null;
let searchTerm = "";

/* UTILITÁRIOS */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function saveAll() {
    write(DB.users, users);
    write(DB.posts, posts);
    write(DB.notifications, notifications);
    write(DB.messages, messages);
}

function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function avatar(name) {
    return escapeHTML((name || "U").trim().charAt(0).toUpperCase());
}

function formatDate(date) {
    const difference = Math.max(0, Date.now() - new Date(date).getTime());
    const minutes = Math.floor(difference / 60000);

    if (minutes < 1) return "Agora mesmo";
    if (minutes < 60) return `Há ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Há ${hours} h`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `Há ${days} dias`;

    return new Date(date).toLocaleDateString("pt-BR");
}

function toast(message) {
    const element = document.getElementById("toast");
    element.textContent = message;
    element.classList.add("show");

    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove("show"), 2800);
}

function getUser(id) {
    return users.find(user => user.id === id);
}

function getPost(id) {
    return posts.find(post => post.id === id);
}

function isFollowing(userId) {
    return (currentUser.following || []).includes(userId);
}

function countFollowers(userId) {
    return users.filter(user =>
        (user.following || []).includes(userId)
    ).length;
}

function notify(userId, text, type = "general") {
    if (!userId || userId === currentUser.id) return;

    notifications.unshift({
        id: makeId(),
        userId,
        from: currentUser.id,
        text,
        type,
        date: new Date().toISOString(),
        read: false
    });

    saveAll();
    updateNotificationBadge();
}

function updateNotificationBadge() {
    const count = notifications.filter(n =>
        n.userId === currentUser?.id && !n.read
    ).length;

    const badge = document.getElementById("notificationBadge");

    badge.textContent = count;
    badge.classList.toggle("hidden", count === 0);
}

/* AUTENTICAÇÃO */

const authScreen = document.getElementById("authScreen");
const app = document.getElementById("app");
const authForm = document.getElementById("authForm");
const nameField = document.getElementById("nameField");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authError = document.getElementById("authError");
const authSubmit = document.getElementById("authSubmit");

function setAuthMode(mode) {
    authMode = mode;
    authError.textContent = "";

    document.getElementById("loginTab").classList.toggle(
        "active", mode === "login"
    );

    document.getElementById("registerTab").classList.toggle(
        "active", mode === "register"
    );

    nameField.classList.toggle("hidden", mode === "login");
    authName.required = mode === "register";

    authSubmit.textContent = mode === "login" ? "Entrar" : "Criar conta";
}

document.getElementById("loginTab").addEventListener("click", () => {
    setAuthMode("login");
});

document.getElementById("registerTab").addEventListener("click", () => {
    setAuthMode("register");
});

authForm.addEventListener("submit", event => {
    event.preventDefault();

    const email = authEmail.value.trim().toLowerCase();
    const password = authPassword.value;

    if (authMode === "register") {
        const name = authName.value.trim();

        if (name.length < 2) {
            authError.textContent = "Digite um nome válido.";
            return;
        }

        if (password.length < 4) {
            authError.textContent = "A senha precisa ter pelo menos 4 caracteres.";
            return;
        }

        if (users.some(user => user.email === email)) {
            authError.textContent = "Este e-mail já está cadastrado.";
            return;
        }

        const newUser = {
            id: makeId(),
            name,
            email,
            password,
            bio: "Olá! Estou usando o Bookface.",
            following: [],
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        saveAll();

        loginUser(newUser);
    } else {
        const user = users.find(user =>
            user.email === email && user.password === password
        );

        if (!user) {
            authError.textContent = "E-mail ou senha incorretos.";
            return;
        }

        loginUser(user);
    }
});

function loginUser(user) {
    currentUser = user;
    localStorage.setItem(DB.session, user.id);

    authScreen.classList.add("hidden");
    app.classList.remove("hidden");

    updateInterface();
    navigate("home");
}

function logout() {
    currentUser = null;
    localStorage.removeItem(DB.session);

    app.classList.add("hidden");
    authScreen.classList.remove("hidden");

    authForm.reset();
    setAuthMode("login");
}

/* INICIALIZAÇÃO */

function initialize() {
    const sessionId = localStorage.getItem(DB.session);

    if (sessionId) {
        const user = users.find(user => user.id === sessionId);

        if (user) {
            loginUser(user);
            return;
        }

        localStorage.removeItem(DB.session);
    }

    authScreen.classList.remove("hidden");
    app.classList.add("hidden");
}

function updateInterface() {
    document.getElementById("sidebarName").textContent = currentUser.name;
    document.getElementById("sidebarAvatar").textContent = avatar(currentUser.name);
    document.getElementById("headerAvatar").textContent = avatar(currentUser.name);

    updateNotificationBadge();
    renderSuggestions();
}

/* NAVEGAÇÃO */

function navigate(page, parameter = null) {
    currentPage = page;

    document.querySelectorAll("[data-page]").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.page === page
        );
    });

    const content = document.getElementById("pageContent");

    switch (page) {
        case "home":
            content.innerHTML = renderHome();
            break;

        case "explore":
            content.innerHTML = renderExplore();
            break;

        case "profile":
            content.innerHTML = renderProfile(
                parameter || currentUser.id
            );
            break;

        case "friends":
            content.innerHTML = renderFriends();
            break;

        case "notifications":
            content.innerHTML = renderNotifications();
            break;

        case "messages":
            content.innerHTML = renderMessages();
            break;

        case "settings":
            content.innerHTML = renderSettings();
            break;

        case "search":
            content.innerHTML = renderSearch();
            break;

        default:
            content.innerHTML = renderHome();
    }
}

/* PUBLICAÇÕES */

function createPost() {
    const input = document.getElementById("postText");
    const content = input.value.trim();

    if (!content && !selectedImage) {
        toast("Escreva algo ou escolha uma imagem.");
        return;
    }

    posts.unshift({
        id: makeId(),
        userId: currentUser.id,
        content,
        image: selectedImage,
        likes: [],
        comments: [],
        date: new Date().toISOString()
    });

    selectedImage = null;
    saveAll();

    navigate(currentPage);
    toast("Publicação realizada!");
}

function renderComposer() {
    return `
        <section class="create-post">
            <div class="create-post-top">
                <div class="avatar">${avatar(currentUser.name)}</div>
                <strong>${escapeHTML(currentUser.name)}</strong>
            </div>

            <textarea id="postText"
                maxlength="2000"
                placeholder="O que você gostaria de compartilhar?"></textarea>

            <div id="imagePreview"></div>

            <div class="create-post-bottom">
                <label class="upload-label">
                    ♧ Adicionar imagem
                    <input type="file" id="imageInput" accept="image/jpeg,image/png,image/webp">
                </label>

                <button class="primary-button" id="publishPost">
                    Publicar
                </button>
            </div>
        </section>
    `;
}

function renderPost(post) {
    const author = getUser(post.userId);

    if (!author) return "";

    const liked = post.likes.includes(currentUser.id);
    const comments = post.comments || [];

    const commentsHTML = comments.map(comment => {
        const commenter = getUser(comment.userId);

        if (!commenter) return "";

        return `
            <div class="comment">
                <div class="avatar">${avatar(commenter.name)}</div>
                <div class="comment-bubble">
                    <strong>${escapeHTML(commenter.name)}</strong>
                    ${escapeHTML(comment.text)}
                </div>
            </div>
        `;
    }).join("");

    return `
        <article class="post" data-post="${post.id}">

            <div class="post-header">
                <button class="avatar" data-profile="${author.id}">
                    ${avatar(author.name)}
                </button>

                <div class="post-user-info">
                    <strong>${escapeHTML(author.name)}</strong>
                    <small>${formatDate(post.date)}</small>
                </div>

                ${post.userId === currentUser.id ? `
                    <button class="post-menu" data-delete="${post.id}"
                        title="Excluir publicação">⋯</button>
                ` : ""}
            </div>

            <p class="post-content">${escapeHTML(post.content)}</p>

            ${post.image ? `
                <img class="post-image"
                    src="${post.image}"
                    alt="Imagem da publicação">
            ` : ""}

            <div class="post-stats">
                <span>♥ ${post.likes.length} curtidas</span>
                <span>${comments.length} comentários</span>
            </div>

            <div class="post-actions">
                <button class="${liked ? "liked" : ""}"
                    data-like="${post.id}">
                    ${liked ? "♥ Curtido" : "♡ Curtir"}
                </button>

                <button data-comment="${post.id}">
                    ◯ Comentar
                </button>

                <button data-share="${post.id}">
                    ↗ Compartilhar
                </button>
            </div>

            <div class="comments">
                ${commentsHTML}

                <form class="comment-form" data-comment-form="${post.id}">
                    <input type="text" maxlength="500"
                        placeholder="Escreva um comentário..."
                        required>
                    <button type="submit">Enviar</button>
                </form>
            </div>

        </article>
    `;
}

function renderFeed(list) {
    if (!list.length) {
        return `
            <div class="empty-state">
                <h3>Nenhuma publicação encontrada</h3>
                <p>Seja o primeiro a compartilhar alguma coisa!</p>
            </div>
        `;
    }

    return list.map(renderPost).join("");
}

function renderHome() {
    const followed = currentUser.following || [];

    const feed = posts.filter(post =>
        post.userId === currentUser.id ||
        followed.includes(post.userId)
    );

    return `
        <section>
            <h1 class="page-title">Início</h1>
            <p class="page-subtitle">Veja o que está acontecendo na sua comunidade.</p>
            ${renderComposer()}
            ${renderFeed(feed)}
        </section>
    `;
}

/* EXPLORAR */

function renderExplore() {
    return `
        <h1 class="page-title">Explorar</h1>
        <p class="page-subtitle">Descubra novas ideias e publicações.</p>

        ${renderFeed(posts)}
    `;
}

/* PERFIL */

function renderProfile(userId) {
    const user = getUser(userId);

    if (!user) {
        return `<div class="empty-state">Usuário não encontrado.</div>`;
    }

    const ownProfile = user.id === currentUser.id;
    const following = isFollowing(user.id);

    const userPosts = posts.filter(post => post.userId === user.id);

    return `
        <section class="profile-header">
            <div class="cover"></div>

            <div class="profile-info">
                <div class="avatar">${avatar(user.name)}</div>

                <h2>${escapeHTML(user.name)}</h2>
                <p>${escapeHTML(user.bio || "Sem descrição.")}</p>

                <div class="profile-stats">
                    <span><strong>${userPosts.length}</strong> publicações</span>
                    <span><strong>${countFollowers(user.id)}</strong> seguidores</span>
                    <span><strong>${(user.following || []).length}</strong> seguindo</span>
                </div>

                <div style="margin-top:18px; display:flex; gap:10px; flex-wrap:wrap;">
                    ${ownProfile ? `
                        <button class="primary-button" id="editProfile">
                            Editar perfil
                        </button>
                    ` : `
                        <button class="primary-button" data-follow="${user.id}">
                            ${following ? "Deixar de seguir" : "Seguir"}
                        </button>
                        <button class="follow-button"
                            data-message="${user.id}">
                            Enviar mensagem
                        </button>
                    `}
                </div>
            </div>
        </section>

        <h2 class="page-title">Publicações</h2>

        ${renderFeed(userPosts)}
    `;
}

/* PESSOAS */

function renderFriends() {
    const people = users.filter(user => user.id !== currentUser.id);

    if (!people.length) {
        return `
            <div class="empty-state">
                <h3>Ainda não há outras pessoas</h3>
                <p>Convide alguém para conhecer o Bookface.</p>
            </div>
        `;
    }

    return `
        <h1 class="page-title">Pessoas</h1>
        <p class="page-subtitle">Conheça pessoas e aumente sua rede.</p>

        ${people.map(user => `
            <div class="person-card">
                <button class="avatar" data-profile="${user.id}">
                    ${avatar(user.name)}
                </button>

                <div class="person-info">
                    <strong>${escapeHTML(user.name)}</strong>
                    <small>${countFollowers(user.id)} seguidores</small>
                </div>

                <button class="follow-button" data-follow="${user.id}">
                    ${isFollowing(user.id) ? "Seguindo" : "Seguir"}
                </button>
            </div>
        `).join("")}
    `;
}

/* SUGESTÕES */

function renderSuggestions() {
    const container = document.getElementById("suggestedUsers");

    const suggestions = users.filter(user =>
        user.id !== currentUser.id &&
        !isFollowing(user.id)
    ).slice(0, 4);

    container.innerHTML = suggestions.length
        ? suggestions.map(user => `
            <div class="suggestion">
                <button class="avatar" data-profile="${user.id}">
                    ${avatar(user.name)}
                </button>

                <div class="suggestion-info">
                    <strong>${escapeHTML(user.name)}</strong>
                    <small>${countFollowers(user.id)} seguidores</small>
                </div>

                <button class="follow-button" data-follow="${user.id}">
                    +
                </button>
            </div>
        `).join("")
        : `<p>Você já segue todas as pessoas disponíveis!</p>`;
}

/* SEGUIR E DEIXAR DE SEGUIR */

function toggleFollow(userId) {
    if (userId === currentUser.id) return;

    const target = getUser(userId);
    if (!target) return;

    currentUser.following ||= [];

    if (isFollowing(userId)) {
        currentUser.following = currentUser.following.filter(
            id => id !== userId
        );

        toast("Você deixou de seguir esta pessoa.");
    } else {
        currentUser.following.push(userId);
        notify(userId, `${currentUser.name} começou a seguir você.`, "follow");
        toast("Agora você está seguindo esta pessoa!");
    }

    saveAll();
    updateInterface();
    navigate(currentPage, currentPage === "profile" ? userId : null);
}

/* CURTIR */

function toggleLike(postId) {
    const post = getPost(postId);
    if (!post) return;

    post.likes ||= [];

    const index = post.likes.indexOf(currentUser.id);

    if (index >= 0) {
        post.likes.splice(index, 1);
    } else {
        post.likes.push(currentUser.id);
        notify(post.userId, `${currentUser.name} curtiu sua publicação.`, "like");
    }

    saveAll();
    navigate(currentPage);
}

/* COMENTÁRIOS */

function addComment(postId, text) {
    const post = getPost(postId);
    if (!post || !text.trim()) return;

    post.comments ||= [];

    post.comments.push({
        id: makeId(),
        userId: currentUser.id,
        text: text.trim(),
        date: new Date().toISOString()
    });

    notify(post.userId, `${currentUser.name} comentou na sua publicação.`, "comment");

    saveAll();
    navigate(currentPage);
    toast("Comentário enviado!");
}

/* EXCLUIR PUBLICAÇÃO */

function deletePost(postId) {
    const post = getPost(postId);

    if (!post || post.userId !== currentUser.id) return;

    if (!confirm("Deseja realmente excluir esta publicação?")) return;

    posts = posts.filter(item => item.id !== postId);

    saveAll();
    navigate(currentPage);
    toast("Publicação excluída.");
}

/* COMPARTILHAR */

function sharePost(postId) {
    const post = getPost(postId);
    if (!post) return;

    const author = getUser(post.userId);
    const text = `${author?.name || "Bookface"}: ${post.content}`;

    if (navigator.share) {
        navigator.share({
            title: "Bookface",
            text
        }).catch(() => {});
    } else if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => toast("Texto copiado!"))
            .catch(() => toast("Não foi possível copiar."));
    } else {
        toast("Compartilhamento indisponível neste navegador.");
    }
}

/* NOTIFICAÇÕES */

function renderNotifications() {
    const ownNotifications = notifications.filter(
        item => item.userId === currentUser.id
    );

    ownNotifications.forEach(item => item.read = true);
    saveAll();
    updateNotificationBadge();

