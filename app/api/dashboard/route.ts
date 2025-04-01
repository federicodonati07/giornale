import { NextResponse } from "next/server";
import { initAdminSDK } from "@/lib/firebase-admin";
import { getDatabase } from "firebase-admin/database";

// Initialize Firebase Admin SDK
const admin = initAdminSDK();

export async function GET() {
  try {
    console.log("Starting dashboard data fetch...");

    // Initialize the admin database
    const db = getDatabase();

    // Ottieni gli utenti da Firebase Auth
    console.log("Fetching users data from Firebase Auth...");
    let users = [];
    let authUsers = [];

    try {
      // Accedi a Firebase Auth
      const adminAuth = admin.auth();
      console.log("Successfully connected to Firebase Auth");

      // Ottieni gli utenti da Firebase Auth
      const userRecords = await adminAuth.listUsers(1000);
      console.log(
        `Retrieved ${userRecords.users.length} users from Firebase Auth`
      );

      // Trasforma i record in un formato più semplice
      authUsers = userRecords.users.map((user) => ({
        id: user.uid,
        displayName: user.displayName || user.email?.split("@")[0] || "Utente",
        email: user.email || "Email non disponibile",
        createdAt: user.metadata.creationTime || new Date().toISOString(),
        lastSignInTime: user.metadata.lastSignInTime,
        emailVerified: user.emailVerified,
        role: "User", // Ruolo di default
      }));

      // Tenta di arricchire i dati degli utenti con informazioni dal database
      // Cerca in diverse posizioni nel database
      const paths = ["utenti", "users", "user"];
      const userDbData: Record<string, any> = {};

      for (const path of paths) {
        console.log(`Checking ${path} path for additional user data...`);
        const snapshot = await db.ref(path).once("value");
        if (snapshot.exists() && snapshot.val()) {
          const userData = snapshot.val();
          console.log(
            `Found additional data in ${path} with ${
              Object.keys(userData).length
            } entries`
          );

          // Unisci i dati del database
          Object.assign(userDbData, userData);
        }
      }

      // Arricchisci i dati utente con informazioni aggiuntive dal database
      users = authUsers.map((authUser) => {
        const dbUserData = userDbData[authUser.id] || {};
        return {
          ...authUser,
          // Usa i dati del database se disponibili, altrimenti mantieni quelli di Auth
          displayName: dbUserData.displayName || authUser.displayName,
          role: dbUserData.role || authUser.role,
        };
      });

      console.log(
        `Processed ${users.length} users with combined Auth and Database data`
      );
    } catch (authError) {
      console.error("Error fetching users from Firebase Auth:", authError);

      // Se fallisce Auth, tenta di recuperare solo dal database Realtime
      console.log("Falling back to database-only approach...");

      try {
        // Try multiple possible paths for user data
        const paths = ["utenti", "users", "user"];

        for (const path of paths) {
          console.log(`Checking ${path} path...`);
          const snapshot = await db.ref(path).once("value");
          if (snapshot.exists() && snapshot.val()) {
            const userData = snapshot.val();
            console.log(
              `Found data in ${path} with ${
                Object.keys(userData).length
              } entries`
            );

            // Convert to array format with proper id
            users = Object.entries(userData).map(([id, data]) => ({
              id,
              ...(data as any),
              // Ensure createdAt exists (fallback to current date)
              createdAt: (data as any).createdAt || new Date().toISOString(),
            }));

            if (users.length > 0) {
              console.log(
                `Successfully retrieved ${users.length} users from ${path}`
              );
              break; // Exit the loop if we found users
            }
          }
        }
      } catch (dbError) {
        console.error("Error also when fetching from database:", dbError);
      }
    }

    // Se non sono stati trovati utenti, genera dati di esempio
    if (users.length === 0) {
      console.log("No users found. Creating mock data for development...");
      users = [
        {
          id: "mock1",
          displayName: "Mario Rossi",
          email: "mario.rossi@example.com",
          createdAt: new Date(
            Date.now() - 60 * 24 * 60 * 60 * 1000
          ).toISOString(), // 60 days ago
          role: "Editor",
        },
        {
          id: "mock2",
          displayName: "Laura Bianchi",
          email: "laura.bianchi@example.com",
          createdAt: new Date(
            Date.now() - 45 * 24 * 60 * 60 * 1000
          ).toISOString(), // 45 days ago
          role: "Contributor",
        },
        {
          id: "mock3",
          displayName: "Giuseppe Verdi",
          email: "giuseppe.verdi@example.com",
          createdAt: new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000
          ).toISOString(), // 30 days ago
          role: "Reader",
        },
        {
          id: "mock4",
          displayName: "Francesca Neri",
          email: "francesca.neri@example.com",
          createdAt: new Date(
            Date.now() - 20 * 24 * 60 * 60 * 1000
          ).toISOString(), // 20 days ago
          role: "Contributor",
        },
        {
          id: "mock5",
          displayName: "Alessandro Russo",
          email: "alessandro.russo@example.com",
          createdAt: new Date(
            Date.now() - 15 * 24 * 60 * 60 * 1000
          ).toISOString(), // 15 days ago
          role: "Reader",
        },
        {
          id: "mock6",
          displayName: "Chiara Esposito",
          email: "chiara.esposito@example.com",
          createdAt: new Date(
            Date.now() - 10 * 24 * 60 * 60 * 1000
          ).toISOString(), // 10 days ago
          role: "Editor",
        },
        {
          id: "mock7",
          displayName: "Marco Ferrari",
          email: "marco.ferrari@example.com",
          createdAt: new Date(
            Date.now() - 5 * 24 * 60 * 60 * 1000
          ).toISOString(), // 5 days ago
          role: "Reader",
        },
        {
          id: "mock8",
          displayName: "Sofia Romano",
          email: "sofia.romano@example.com",
          createdAt: new Date(
            Date.now() - 3 * 24 * 60 * 60 * 1000
          ).toISOString(), // 3 days ago
          role: "Reader",
        },
        {
          id: "mock9",
          displayName: "Luca Marino",
          email: "luca.marino@example.com",
          createdAt: new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000
          ).toISOString(), // 2 days ago
          role: "Contributor",
        },
        {
          id: "mock10",
          displayName: "Giulia Costa",
          email: "giulia.costa@example.com",
          createdAt: new Date(
            Date.now() - 1 * 24 * 60 * 60 * 1000
          ).toISOString(), // 1 day ago
          role: "Reader",
        },
      ];
    }

    console.log(`Final user count: ${users.length} users`);

    // Fetch articles data
    console.log("Fetching articles data...");
    const articlesSnapshot = await db.ref("articoli").once("value");
    const articlesData = articlesSnapshot.val() || {};

    // Convert to array and calculate stats
    const articles = Object.entries(articlesData).map(([id, data]) => ({
      id,
      ...(data as any),
    }));
    console.log(`Processed ${articles.length} articles`);

    // Calculate total stats
    const totalUsers = users.length;
    const totalArticles = articles.length;
    const totalViews = articles.reduce(
      (sum, article) => sum + ((article as any).view || 0),
      0
    );
    const totalLikes = articles.reduce(
      (sum, article) => sum + ((article as any).upvote || 0),
      0
    );
    const totalShares = articles.reduce(
      (sum, article) => sum + ((article as any).shared || 0),
      0
    );

    // Count of sensitive content
    const sensitiveTags = articles.filter(
      (article) =>
        Array.isArray((article as any).sensitiveTags) &&
        (article as any).sensitiveTags.length > 0
    ).length;

    // Get recent users (with fallback for missing values)
    const recentUsers = [...users]
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10)
      .map((user) => ({
        ...user,
        displayName: user.displayName || "Utente senza nome",
        email: user.email || "Email non disponibile",
        createdAt: user.createdAt || new Date().toISOString(),
      }));

    console.log(`Retrieved ${recentUsers.length} recent users`);

    // Extract registration stats for chart - ultimi 12 mesi
    const last12Months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last12Months.push({
        month: month.toLocaleString("it-IT", { month: "short" }),
        year: month.getFullYear(),
        key: `${month.getFullYear()}-${month.getMonth() + 1}`,
        count: 0,
      });
    }

    // Calculate user registrations by month
    const usersByMonth = {};
    users.forEach((user) => {
      try {
        const date = new Date(user.createdAt);
        if (!isNaN(date.getTime())) {
          const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
          usersByMonth[monthKey] = (usersByMonth[monthKey] || 0) + 1;
        }
      } catch (err) {
        console.error(`Error processing date for user ${user.id}:`, err);
      }
    });

    // Fill in the chart data
    const registrationChartData = last12Months.map((item) => {
      return {
        ...item,
        count: usersByMonth[item.key] || 0,
      };
    });

    console.log("User registration chart data ready with 12 months");

    // Extract registration stats for chart
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    // Process article categories with multiple approaches
    const categoryCounts: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};

    articles.forEach((article) => {
      // Process main category first
      let mainCategory = "";

      // Try different fields with fallbacks
      const articleData = article as any;

      // Approach 1: Check for categoria field
      if (articleData.categoria && typeof articleData.categoria === "string") {
        mainCategory = articleData.categoria.trim();
      }

      // Approach 2: Check for category field
      else if (
        articleData.category &&
        typeof articleData.category === "string"
      ) {
        mainCategory = articleData.category.trim();
      }

      // Approach 3: Check tag field and use first tag
      else if (articleData.tag && typeof articleData.tag === "string") {
        const tags = articleData.tag.split(",");
        if (tags.length > 0) {
          mainCategory = tags[0].trim();

          // Also count all tags separately
          tags.forEach((tag) => {
            const trimmedTag = tag.trim();
            if (trimmedTag) {
              if (!tagCounts[trimmedTag]) {
                tagCounts[trimmedTag] = 0;
              }
              tagCounts[trimmedTag] += 1;
            }
          });
        }
      }

      // Use fallback if no category was found
      if (!mainCategory) {
        mainCategory = "Non categorizzato";
      }

      // Count for main category
      if (!categoryCounts[mainCategory]) {
        categoryCounts[mainCategory] = 0;
      }
      categoryCounts[mainCategory] += 1;
    });

    console.log(
      `Processed ${Object.keys(categoryCounts).length} categories and ${
        Object.keys(tagCounts).length
      } tags`
    );

    // Return dashboard data with enhanced information
    return NextResponse.json({
      stats: {
        totalUsers,
        totalArticles,
        totalViews,
        totalLikes,
        totalShares,
        sensitiveTags,
      },
      recentUsers,
      users,
      categoryCounts,
      tagCounts,
      registrationChartData,
      debug: {
        userCount: users.length,
        articleCount: articles.length,
        recentUserCount: recentUsers.length,
        hasSensitiveContent: sensitiveTags > 0,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      {
        error: "Error fetching dashboard data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
