allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
// file_picker 11.x deja de aplicar el plugin de Kotlin cuando ve AGP 9 (da
// por hecho el Kotlin integrado de AGP), pero este proyecto lo tiene apagado
// (`android.builtInKotlin=false`, del template de Flutter). Resultado: su
// código Kotlin no se compilaba y el build caía con "cannot find symbol
// FilePickerPlugin" (2026-11-17). Se le aplica el plugin acá. No se sube a
// file_picker 12+ porque exige iOS 14 y la app todavía apunta a iOS 13.
subprojects {
    if (name == "file_picker") {
        plugins.withId("com.android.library") {
            apply(plugin = "org.jetbrains.kotlin.android")
            tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
                compilerOptions.jvmTarget.set(
                    org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17,
                )
            }
        }
    }
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
