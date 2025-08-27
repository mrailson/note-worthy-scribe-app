// Script to create the user account
async function createUser() {
    try {
        console.log('Creating user egplearning@gmail.com...');
        
        const response = await fetch('https://dphcnbricafkbtizkoal.supabase.co/functions/v1/create-user-admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'
            },
            body: JSON.stringify({
                email: 'egplearning@gmail.com',
                password: 'SurgeryConnect1',
                fullName: 'EGP Learning User',
                role: 'system_admin',
                moduleAccess: {
                    ai4gp_access: true,
                    meeting_recorder_access: true,
                    ai_meeting_notes_access: true,
                    practice_manager_access: true
                }
            })
        });

        const result = await response.json();
        console.log('Response:', result);
        
        if (response.ok) {
            console.log('✅ User created successfully!');
            // Now assign practice manager role for Oak Lane Medical Practice
            await assignPracticeRole(result.user_id || 'user-created');
        } else {
            console.error('❌ Error creating user:', result);
        }
        
        return result;
    } catch (error) {
        console.error('❌ Network Error:', error);
        return { error: error.message };
    }
}

async function assignPracticeRole(userId) {
    try {
        console.log('Assigning practice manager role...');
        
        const response = await fetch('https://dphcnbricafkbtizkoal.supabase.co/functions/v1/create-user-practice-manager', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'
            },
            body: JSON.stringify({
                email: 'egplearning@gmail.com',
                fullName: 'EGP Learning User',
                practiceRole: 'practice_manager',
                moduleAccess: {
                    ai4gp_access: true,
                    meeting_recorder_access: true,
                    ai_meeting_notes_access: true,
                    practice_manager_access: true
                }
            })
        });
        
        const result = await response.json();
        console.log('Practice role assignment:', result);
        
        if (response.ok) {
            console.log('✅ Practice manager role assigned successfully!');
        } else {
            console.log('⚠️ User created but practice role assignment had issues:', result);
        }
    } catch (error) {
        console.error('⚠️ Error assigning practice role:', error);
    }
}

// Run the script
createUser().then(result => {
    console.log('Final result:', result);
});