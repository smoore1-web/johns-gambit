plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.smoore.johnsgambit"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.smoore.johnsgambit"
        minSdk = 26
        targetSdk = 35
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "1.0." + (System.getenv("GITHUB_RUN_NUMBER") ?: "0")
    }

    // Personal app: one fixed key so every new APK installs over the old one
    // and your progress is kept.
    signingConfigs {
        create("personal") {
            storeFile = file("../keystore/johns-gambit.jks")
            storePassword = "johnsgambit"
            keyAlias = "johnsgambit"
            keyPassword = "johnsgambit"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("personal")
        }
        debug {
            signingConfig = signingConfigs.getByName("personal")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }

    androidResources {
        // Keep .wasm and .json uncompressed-friendly and don't skip any game files
        noCompress += listOf("wasm")
        ignoreAssetsPattern = "!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~"
    }
}

// The game itself lives in /web. The build workflow copies it into
// src/main/assets/www before running Gradle (see .github/workflows/build.yml).

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
}
