// ========== GLOBAL VARIABLES ==========
let currentUser = null;
let editStudentId = null;
const ADMIN_EMAIL = "duladagn25@gmail.com";

// ========== HELPER FUNCTIONS ==========
function showAlert(message, type = 'success') {
    const alertDiv = document.getElementById('alert');
    alertDiv.className = `alert alert-${type} show`;
    alertDiv.innerHTML = message;
    setTimeout(() => {
        alertDiv.classList.remove('show');
    }, 3000);
}

// ========== CREATE DEFAULT ADMIN ==========
async function createDefaultAdmin() {
    try {
        const usersRef = collection(window.db, 'users');
        const q = query(usersRef, where('email', '==', ADMIN_EMAIL));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            const userCred = await createUserWithEmailAndPassword(window.auth, ADMIN_EMAIL, 'Admin@123456');
            
            await addDoc(collection(window.db, 'users'), {
                uid: userCred.user.uid,
                name: 'Duladagne (Administrator)',
                email: ADMIN_EMAIL,
                role: 'admin',
                paymentStatus: true,
                createdAt: new Date().toISOString()
            });
            
            console.log('Admin created for', ADMIN_EMAIL);
            showAlert('Admin account created! Login with your email.', 'success');
        }
    } catch (error) {
        console.log('Admin may already exist:', error.message);
    }
}

// ========== AUTHENTICATION ==========
async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showAlert('Please enter email and password!', 'error');
        return;
    }
    
    try {
        const userCred = await signInWithEmailAndPassword(window.auth, email, password);
        const uid = userCred.user.uid;
        
        const usersRef = collection(window.db, 'users');
        const q = query(usersRef, where('uid', '==', uid));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            querySnapshot.forEach(doc => {
                currentUser = { id: doc.id, ...doc.data() };
            });
        }
        
        // Ensure admin role for your email
        if (currentUser.email === ADMIN_EMAIL && currentUser.role !== 'admin') {
            const userRef = doc(window.db, 'users', currentUser.id);
            await updateDoc(userRef, { role: 'admin' });
            currentUser.role = 'admin';
        }
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        document.getElementById('loginView').style.display = 'none';
        document.getElementById('dashboardView').style.display = 'block';
        
        const roleText = currentUser.role === 'admin' ? '👑 Administrator (Full Control)' : '🎓 Student (View Only)';
        document.getElementById('userInfo').innerHTML = `
            👋 Welcome, ${currentUser.name}<br>
            <small>${roleText}</small>
            <button onclick="logout()">🚪 Logout</button>
        `;
        
        loadDashboard();
        showAlert(`Welcome ${currentUser.name}!`, 'success');
        
    } catch (error) {
        document.getElementById('loginError').innerHTML = error.message;
        showAlert(error.message, 'error');
    }
}

async function register() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const region = document.getElementById('regRegion').value;
    const city = document.getElementById('regCity').value;
    const course = document.getElementById('regCourse').value;
    
    // Prevent registration with admin email
    if (email === ADMIN_EMAIL) {
        showAlert('This email is reserved for admin!', 'error');
        return;
    }
    
    if (!name || !email || !password || !region || !city || !course) {
        showAlert('Please fill all fields!', 'error');
        return;
    }
    
    try {
        const userCred = await createUserWithEmailAndPassword(window.auth, email, password);
        
        await addDoc(collection(window.db, 'users'), {
            uid: userCred.user.uid,
            name: name,
            email: email,
            role: 'student',
            region: region,
            city: city,
            course: course,
            paymentStatus: false,
            registeredAt: new Date().toISOString()
        });
        
        showAlert('Registration successful! Please login.', 'success');
        
        // Clear form
        document.getElementById('regName').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPassword').value = '';
        document.getElementById('regRegion').value = '';
        document.getElementById('regCity').value = '';
        document.getElementById('regCourse').value = '';
        
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

async function logout() {
    await signOut(window.auth);
    localStorage.removeItem('currentUser');
    currentUser = null;
    document.getElementById('loginView').style.display = 'block';
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    showAlert('Logged out successfully!', 'success');
}

// ========== DASHBOARD FUNCTIONS ==========
async function loadDashboard() {
    await updateStats();
    
    const isAdmin = currentUser.role === 'admin' || currentUser.email === ADMIN_EMAIL;
    
    if (isAdmin) {
        document.getElementById('adminMaterialPanel').style.display = 'block';
        await loadStudents();
    } else {
        document.getElementById('adminMaterialPanel').style.display = 'none';
        await loadMyInfo();
    }
    
    await loadMaterials();
    await loadPaymentInfo();
}

async function updateStats() {
    const usersRef = collection(window.db, 'users');
    const querySnapshot = await getDocs(usersRef);
    const students = [];
    const regions = new Set();
    const cities = new Set();
    
    querySnapshot.forEach(doc => {
        const user = doc.data();
        if (user.role === 'student') {
            students.push(user);
            if (user.region) regions.add(user.region);
            if (user.city) cities.add(user.city);
        }
    });
    
    const isAdmin = currentUser.role === 'admin' || currentUser.email === ADMIN_EMAIL;
    
    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${students.length}</div>
            <div>Total Students</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${regions.size}</div>
            <div>Ethiopian Regions</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${cities.size}</div>
            <div>Cities Available</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${isAdmin ? '👑' : '🎓'}</div>
            <div>${isAdmin ? 'Administrator (YOU)' : 'Student'}</div>
        </div>
    `;
}

async function loadStudents() {
    const isAdmin = currentUser.role === 'admin' || currentUser.email === ADMIN_EMAIL;
    
    if (!isAdmin) {
        await loadMyInfo();
        return;
    }
    
    const usersRef = collection(window.db, 'users');
    const q = query(usersRef, where('role', '==', 'student'));
    const querySnapshot = await getDocs(q);
    const container = document.getElementById('studentsList');
    
    if (querySnapshot.empty) {
        container.innerHTML = '<p style="text-align:center; padding:40px;">No students registered yet.</p>';
        return;
    }
    
    let html = '';
    querySnapshot.forEach(doc => {
        const student = { id: doc.id, ...doc.data() };
        html += `
            <div class="student-card">
                <div class="student-info">
                    <strong>${student.name}</strong><br>
                    📧 ${student.email}<br>
                    📍 ${student.region || 'N/A'} - ${student.city || 'N/A'}<br>
                    📚 ${student.course || 'N/A'}<br>
                    <div class="payment-status ${student.paymentStatus ? 'paid' : 'unpaid'}">
                        ${student.paymentStatus ? '✅ Payment Completed' : '⏳ Payment Pending'}
                    </div>
                </div>
                <div class="student-actions">
                    <button onclick="editStudent('${student.id}')">✏️ Edit</button>
                    <button class="danger" onclick="deleteStudent('${student.id}')">🗑️ Delete</button>
                    <button class="success" onclick="togglePayment('${student.id}')">💰 Toggle Payment</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function loadMyInfo() {
    const usersRef = collection(window.db, 'users');
    const q = query(usersRef, where('email', '==', currentUser.email));
    const querySnapshot = await getDocs(q);
    const container = document.getElementById('studentsList');
    
    querySnapshot.forEach(doc => {
        const myData = doc.data();
        container.innerHTML = `
            <div class="student-card">
                <div class="student-info">
                    <strong>${myData.name}</strong><br>
                    📧 ${myData.email}<br>
                    📍 ${myData.region || 'N/A'} - ${myData.city || 'N/A'}<br>
                    📚 ${myData.course || 'N/A'}<br>
                    <div class="payment-status ${myData.paymentStatus ? 'paid' : 'unpaid'}">
                        ${myData.paymentStatus ? '✅ Payment Completed - Full Access' : '⏳ Payment Pending - Limited Access'}
                    </div>
                    <hr>
                    <small>⚠️ You can only view your own information. Admin manages everything.</small>
                </div>
            </div>
        `;
    });
}

function editStudent(id) {
    editStudentId = id;
    document.getElementById('editModal').style.display = 'block';
}

async function saveEdit() {
    const newName = document.getElementById('editName').value;
    const newCity = document.getElementById('editCity').value;
    const newCourse = document.getElementById('editCourse').value;
    
    if (!newName) {
        showAlert('Please enter name!', 'error');
        return;
    }
    
    const userRef = doc(window.db, 'users', editStudentId);
    await updateDoc(userRef, {
        name: newName,
        city: newCity,
        course: newCourse
    });
    
    closeModal();
    await loadStudents();
    showAlert('Student updated successfully!', 'success');
}

async function deleteStudent(id) {
    if (confirm('⚠️ Are you sure you want to delete this student?')) {
        await deleteDoc(doc(window.db, 'users', id));
        await loadStudents();
        await updateStats();
        showAlert('Student deleted successfully!', 'success');
    }
}

async function togglePayment(id) {
    const userRef = doc(window.db, 'users', id);
    const userDoc = await getDocs(query(collection(window.db, 'users'), where('__name__', '==', id)));
    let currentStatus = false;
    
    userDoc.forEach(doc => {
        currentStatus = doc.data().paymentStatus;
    });
    
    await updateDoc(userRef, {
        paymentStatus: !currentStatus
    });
    
    await loadStudents();
    showAlert(`Payment status updated!`, 'success');
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
    editStudentId = null;
    document.getElementById('editName').value = '';
    document.getElementById('editCity').value = '';
}

// ========== MATERIAL FUNCTIONS ==========
async function uploadMaterial() {
    const isAdmin = currentUser.role === 'admin' || currentUser.email === ADMIN_EMAIL;
    
    if (!isAdmin) {
        showAlert('Only admin can upload materials!', 'error');
        return;
    }
    
    const title = document.getElementById('materialTitle').value;
    const type = document.getElementById('materialType').value;
    const url = document.getElementById('materialUrl').value;
    const description = document.getElementById('materialDesc').value;
    
    if (!title || !url) {
        showAlert('Please fill title and URL!', 'error');
        return;
    }
    
    await addDoc(collection(window.db, 'materials'), {
        title: title,
        type: type,
        url: url,
        description: description,
        uploadedBy: currentUser.name,
        createdAt: new Date().toISOString()
    });
    
    document.getElementById('materialTitle').value = '';
    document.getElementById('materialUrl').value = '';
    document.getElementById('materialDesc').value = '';
    
    await loadMaterials();
    showAlert('Material uploaded successfully!', 'success');
}

async function loadMaterials() {
    const materialsRef = collection(window.db, 'materials');
    const querySnapshot = await getDocs(materialsRef);
    const container = document.getElementById('materialsList');
    
    const isAdmin = currentUser.role === 'admin' || currentUser.email === ADMIN_EMAIL;
    let canAccess = isAdmin;
    
    if (!isAdmin && currentUser.role === 'student') {
        canAccess = currentUser.paymentStatus === true;
    }
    
    if (!canAccess) {
        container.innerHTML = `
            <div class="payment-status unpaid" style="text-align:center; padding:30px;">
                ⚠️ Payment Required! <br>
                Please complete payment to access all learning materials.
            </div>
        `;
        return;
    }
    
    if (querySnapshot.empty) {
        container.innerHTML = '<p style="text-align:center; padding:40px;">No materials uploaded yet.</p>';
        return;
    }
    
    let html = '';
    querySnapshot.forEach(doc => {
        const material = { id: doc.id, ...doc.data() };
        html += `
            <div class="material-card">
                <div class="material-info">
                    <strong>${material.title}</strong><br>
                    ${material.description ? material.description + '<br>' : ''}
                    <small>📅 ${new Date(material.createdAt).toLocaleDateString()}</small><br>
                    ${material.type === 'video' ? 
                        `<iframe src="${material.url}" frameborder="0" allowfullscreen></iframe>` : 
                        `<a href="${material.url}" target="_blank" style="display: inline-block; margin-top: 10px;">
                            <button>📄 Download Material</button>
                        </a>`
                    }
                </div>
                ${isAdmin ? `
                    <div class="material-actions">
                        <button class="danger" onclick="deleteMaterial('${material.id}')">🗑️ Delete</button>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function deleteMaterial(id) {
    if (confirm('Delete this material?')) {
        await deleteDoc(doc(window.db, 'materials', id));
        await loadMaterials();
        showAlert('Material deleted!', 'success');
    }
}

// ========== PAYMENT FUNCTIONS ==========
async function loadPaymentInfo() {
    const paymentDiv = document.getElementById('paymentInfo');
    const buttonDiv = document.getElementById('paymentButton');
    const isAdmin = currentUser.role === 'admin' || currentUser.email === ADMIN_EMAIL;
    
    if (isAdmin) {
        paymentDiv.innerHTML = '<p>👑 Admin has full access to all materials and can manage payments.</p>';
        buttonDiv.innerHTML = '';
    } else if (currentUser.role === 'student') {
        if (currentUser.paymentStatus) {
            paymentDiv.innerHTML = `
                <div class="payment-status paid">
                    ✅ Payment Completed! You have full access to all materials.
                </div>
            `;
            buttonDiv.innerHTML = '';
        } else {
            paymentDiv.innerHTML = `
                <div class="payment-status unpaid">
                    ⏳ Payment Pending: 100 ETB<br>
                    After payment, you will get access to all videos and learning materials.
                </div>
            `;
            buttonDiv.innerHTML = `
                <button class="success" onclick="processPayment()">
                    💳 Complete Payment (100 ETB)
                </button>
            `;
        }
    }
}

async function processPayment() {
    const usersRef = collection(window.db, 'users');
    const q = query(usersRef, where('email', '==', currentUser.email));
    const querySnapshot = await getDocs(q);
    
    querySnapshot.forEach(async (doc) => {
        const userRef = doc.ref;
        await updateDoc(userRef, {
            paymentStatus: true
        });
        
        currentUser.paymentStatus = true;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        showAlert('✅ Payment successful! You now have access to all materials.', 'success');
        await loadPaymentInfo();
        await loadMaterials();
        await loadMyInfo();
    });
}

function showTab(tab) {
    document.getElementById('studentsTab').style.display = tab === 'students' ? 'block' : 'none';
    document.getElementById('materialsTab').style.display = tab === 'materials' ? 'block' : 'none';
    document.getElementById('paymentTab').style.display = tab === 'payment' ? 'block' : 'none';
    
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(t => t.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

// ========== INITIALIZE ==========
async function init() {
    await createDefaultAdmin();
    
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        document.getElementById('loginView').style.display = 'none';
        document.getElementById('dashboardView').style.display = 'block';
        
        const roleText = currentUser.role === 'admin' ? '👑 Administrator (Full Control)' : '🎓 Student (View Only)';
        document.getElementById('userInfo').innerHTML = `
            👋 Welcome, ${currentUser.name}<br>
            <small>${roleText}</small>
            <button onclick="logout()">🚪 Logout</button>
        `;
        await loadDashboard();
    }
}

init();

window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target === modal) {
        closeModal();
    }
}
