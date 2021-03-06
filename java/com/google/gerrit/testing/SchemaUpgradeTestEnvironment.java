// Copyright (C) 2017 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package com.google.gerrit.testing;

import com.google.gerrit.lifecycle.LifecycleManager;
import com.google.gerrit.reviewdb.client.Account;
import com.google.gerrit.reviewdb.server.ReviewDb;
import com.google.gerrit.server.CurrentUser;
import com.google.gerrit.server.IdentifiedUser;
import com.google.gerrit.server.account.AccountManager;
import com.google.gerrit.server.account.AuthRequest;
import com.google.gerrit.server.schema.SchemaCreator;
import com.google.gerrit.server.util.RequestContext;
import com.google.gerrit.server.util.ThreadLocalRequestContext;
import com.google.gwtorm.server.SchemaFactory;
import com.google.inject.Guice;
import com.google.inject.Inject;
import com.google.inject.Injector;
import com.google.inject.Provider;
import com.google.inject.util.Providers;
import org.eclipse.jgit.lib.Config;
import org.junit.rules.MethodRule;
import org.junit.runners.model.FrameworkMethod;
import org.junit.runners.model.Statement;

public final class SchemaUpgradeTestEnvironment implements MethodRule {
  private final Provider<Config> configProvider;

  @Inject private AccountManager accountManager;
  @Inject private IdentifiedUser.GenericFactory userFactory;
  @Inject private SchemaFactory<ReviewDb> schemaFactory;
  @Inject private SchemaCreator schemaCreator;
  @Inject private ThreadLocalRequestContext requestContext;
  // Only for use in setting up/tearing down injector.
  @Inject private InMemoryDatabase inMemoryDatabase;

  private ReviewDb db;
  private LifecycleManager lifecycle;

  /** Create a test environment using an empty base config. */
  public SchemaUpgradeTestEnvironment() {
    this(Config::new);
  }

  /**
   * Create a test environment using the specified base config.
   *
   * <p>The config is passed as a provider so it can be lazily initialized after this rule is
   * instantiated, for example using {@link ConfigSuite}.
   *
   * @param configProvider possibly-lazy provider for the base config.
   */
  public SchemaUpgradeTestEnvironment(Provider<Config> configProvider) {
    this.configProvider = configProvider;
  }

  @Override
  public Statement apply(Statement base, FrameworkMethod method, Object target) {
    return new Statement() {
      @Override
      public void evaluate() throws Throwable {
        try {
          setUp(target);
          base.evaluate();
        } finally {
          tearDown();
        }
      }
    };
  }

  public void setApiUser(Account.Id id) {
    IdentifiedUser user = userFactory.create(id);
    requestContext.setContext(
        new RequestContext() {
          @Override
          public CurrentUser getUser() {
            return user;
          }

          @Override
          public Provider<ReviewDb> getReviewDbProvider() {
            return Providers.of(db);
          }
        });
  }

  private void setUp(Object target) throws Exception {
    Config cfg = configProvider.get();
    InMemoryModule.setDefaults(cfg);

    Injector injector =
        Guice.createInjector(new InMemoryModule(cfg, NoteDbMode.newNotesMigrationFromEnv()));
    injector.injectMembers(this);
    lifecycle = new LifecycleManager();
    lifecycle.add(injector);
    lifecycle.start();

    try (ReviewDb underlyingDb = inMemoryDatabase.getDatabase().open()) {
      schemaCreator.create(underlyingDb);
    }
    db = schemaFactory.open();
    setApiUser(accountManager.authenticate(AuthRequest.forUser("user")).getAccountId());

    // Inject target members after setting API user, so it can @Inject a ReviewDb if it wants.
    injector.injectMembers(target);
  }

  private void tearDown() {
    if (lifecycle != null) {
      lifecycle.stop();
    }
    if (requestContext != null) {
      requestContext.setContext(null);
    }
    if (db != null) {
      db.close();
    }
    InMemoryDatabase.drop(inMemoryDatabase);
  }
}
