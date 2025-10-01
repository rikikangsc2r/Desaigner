import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

declare const puter: any;

interface PuterUser {
    uuid: string;
    username: string;
    email_confirmed: boolean;
}

interface AuthContextType {
    user: PuterUser | null;
    isSignedIn: boolean;
    isLoading: boolean;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<PuterUser | null>(null);
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const checkAuthStatus = useCallback(async () => {
        setIsLoading(true);
        try {
            const signedIn = await puter.auth.isSignedIn();
            setIsSignedIn(signedIn);
            if (signedIn) {
                const userData = await puter.auth.getUser();
                setUser(userData);
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("Failed to check auth status:", error);
            setIsSignedIn(false);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const checkPuter = () => {
            if (typeof puter !== 'undefined' && puter.auth) {
                checkAuthStatus();
            } else {
                setTimeout(checkPuter, 100);
            }
        };
        checkPuter();
    }, [checkAuthStatus]);

    const signIn = async () => {
        try {
            await puter.auth.signIn();
            await checkAuthStatus();
        } catch (error) {
            console.error("Sign in failed:", error);
        }
    };

    const signOut = async () => {
        try {
            await puter.auth.signOut();
            await checkAuthStatus();
        } catch (error) {
            console.error("Sign out failed:", error);
        }
    };

    const value = { user, isSignedIn, isLoading, signIn, signOut };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
