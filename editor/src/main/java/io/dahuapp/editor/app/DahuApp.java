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
import javafx.scene.web.WebEvent;
import javafx.stage.WindowEvent;

public class DahuApp extends Application {
    private static final int MIN_WIDTH = 720;
    private static final int MIN_HEIGHT = 520;
    private WebView webview;

    @Override
    public void start(Stage primaryStage) throws Exception {
	System.out.println(com.sun.javafx.runtime.VersionInfo.getRuntimeVersion());
        StackPane root = new StackPane();

        // init dahuapp
        initDahuApp(primaryStage);
        
        // pin it to stackpane
        root.getChildren().add(webview);

        // create the sceen
        Scene scene = new Scene(root, MIN_WIDTH, MIN_HEIGHT);

        primaryStage.setMinWidth(MIN_WIDTH);
        primaryStage.setMinHeight(MIN_HEIGHT);
        primaryStage.setScene(scene);
        primaryStage.show();
    }

    public static void main(String[] args) {
        /* launch app */
        launch(args);
    }

    public static class LoggerProxy {
	public void JSinfo(String message) {
	    System.out.println(message);
	}
    };

    LoggerProxy logger = new LoggerProxy();

    private void initDahuApp(final Stage primaryStage) {
        webview = new WebView();
        webview.setContextMenuEnabled(false);
        webview.getEngine().loadContent("<html><head><title>Hello</title></head><body>content"
					+ "<script>"
					+ "window.testobject = {};"
					+ "function crash() { testobject.logger.JSinfo(\"dahuapp.editor.js\", \"foo\"); };"
					+ "function dontCrash() { testobject.logger.JSinfo(\"dahuapp.editor.js\"); };"
					+ "</script>"
					+ "<br><a onClick=\"crash();\">don't click here</a>"
					+ "<br><a onClick=\"dontCrash();\">click here</a>"
					+ "</body></html>");
	
        // extend the webview js context
        webview.getEngine().getLoadWorker().stateProperty().addListener(new ChangeListener<Worker.State>() {
            @Override
            public void changed(final ObservableValue<? extends Worker.State> observableValue, final State oldState, final State newState) {
                if (newState == State.SUCCEEDED) {
                    // load drivers
                    JSObject testobject = (JSObject) webview.getEngine().executeScript("window.testobject");
                    testobject.setMember("logger", logger);
		    
		    // This works OK
		    webview.getEngine().executeScript("testobject.logger.JSinfo(\"dahuapp.editor.js\");");
		    // One extra parameter => segfault
		    // webview.getEngine().executeScript("testobject.logger.JSinfo(\"dahuapp.editor.js\", \"foo\");");
                }
            }
        });
    }
}
