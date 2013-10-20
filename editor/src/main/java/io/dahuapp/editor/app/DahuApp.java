package io.dahuapp.editor.app;

import io.dahuapp.editor.proxy.DahuAppProxy;
import io.dahuapp.editor.utils.Dialogs;
import java.io.BufferedReader;
import javafx.application.Application;
import static javafx.application.Application.launch;
import javafx.application.Platform;
import javafx.scene.Scene;
import javafx.scene.layout.StackPane;
import javafx.scene.web.WebView;
import javafx.stage.Stage;
import netscape.javascript.JSObject;
import javafx.beans.value.ChangeListener;
import javafx.beans.value.ObservableValue;
import javafx.concurrent.Worker;
import javafx.concurrent.Worker.State;
import javafx.event.EventHandler;
import javafx.scene.web.PromptData;
import javafx.scene.web.WebEvent;
import javafx.stage.WindowEvent;
import javafx.util.Callback;
import java.util.List;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URL;

import java.net.URLClassLoader;

/**
 * Main class of the application. Runs the GUI to allow the user to take
 * screenshots and edit the presentation he wants to make.
 */
public class DahuApp extends Application {
    private static final int MIN_WIDTH = 720;
    private static final int MIN_HEIGHT = 520;
    private WebView webview;

    @Override
    public void start(Stage primaryStage) throws Exception {
        StackPane root = new StackPane();

        // init dahuapp
        initDahuApp(primaryStage);
        
        // pin it to stackpane
        root.getChildren().add(webview);

        // create the sceen
        Scene scene = new Scene(root, MIN_WIDTH, MIN_HEIGHT);

        primaryStage.setOnCloseRequest(new EventHandler<WindowEvent>() {
            @Override
            public void handle(WindowEvent t) {
                webview.getEngine().executeScript("dahuapp.drivers.onStop();");
                Platform.exit();
            }
        });
        primaryStage.setMinWidth(MIN_WIDTH);
        primaryStage.setMinHeight(MIN_HEIGHT);
        primaryStage.setScene(scene);
        primaryStage.show();
    }

    /**
     * The main() method is ignored in correctly deployed JavaFX application.
     * main() serves only as fallback in case the application can not be
     * launched through deployment artifacts, e.g., in IDEs with limited FX
     * support. NetBeans ignores main().
     *
     * @param args the command line arguments
     */
    public static void main(String[] args) {
        /* launch app */
        launch(args);
    }

    DahuAppProxy drivers = new DahuAppProxy();
    /**
     * Initializes the WebView with the HTML content and binds the drivers to
     * the Dahuapp JavaScript object.
     *
     * @param primaryStage Main stage of the app (for the proxy).
     */
    private void initDahuApp(final Stage primaryStage) {
        webview = new WebView();
        webview.setContextMenuEnabled(false);
        webview.getEngine().loadContent("<html><head><title>Hello</title></head><body>content"
					+ "<script>"
					+ "window.dahuapp = {};"
					+ "dahuapp.editor = {};"
					+ "</script>"
					+ "</body></html>");
	
        // extend the webview js context
        webview.getEngine().getLoadWorker().stateProperty().addListener(new ChangeListener<Worker.State>() {
            @Override
            public void changed(final ObservableValue<? extends Worker.State> observableValue, final State oldState, final State newState) {
                if (newState == State.SUCCEEDED) {
                    // load drivers
                    JSObject dahuapp = (JSObject) webview.getEngine().executeScript("window.dahuapp");
                    dahuapp.setMember("drivers", drivers);
		    //dahuapp.setMember("drivers", new DahuAppProxy());

		    webview.getEngine().executeScript("dahuapp.drivers.logger.JSinfo(\"dahuapp.editor.js\", \"init\", \"test\");");
                }
            }
        });
    }
}
