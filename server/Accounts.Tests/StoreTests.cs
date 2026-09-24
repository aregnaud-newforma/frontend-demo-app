// UNIT TEST - Store: FindAccount, SaveAccount, UpdateAccount.
//
// Against a real Postgres 17 that Testcontainers starts once for this class,
// brought to the current schema by the same migrations the API applies at
// startup. So this proves the committed migrations and the queries agree - and
// a model that drifts from its last migration fails here, before anything
// reaches the database `yarn dev` uses. The Node version ran on PGlite,
// Postgres compiled to WebAssembly, and needed no container; .NET has no such
// thing, and a container is the next smallest honest Postgres.
using Accounts;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace Accounts.Tests;

public sealed class PostgresFixture : IAsyncLifetime
{
    public PostgreSqlContainer Container { get; } = new PostgreSqlBuilder("postgres:17").Build();

    public async ValueTask InitializeAsync() => await Container.StartAsync();

    public async ValueTask DisposeAsync() => await Container.DisposeAsync();
}

public sealed class StoreTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private static readonly Account account = new(
        Id: "acc_1",
        Nom: "Lovelace",
        Prenom: "Ada",
        Email: "ada@example.com",
        Telephone: "+33612345678",
        Langue: "fr",
        Bio: "Mathematician");

    private static readonly AccountPayload payload = new(
        Nom: "King",
        Prenom: "Augusta",
        Email: "augusta@example.com",
        Telephone: null,
        Langue: "en",
        Bio: "Countess");

    private AccountsDb db = null!;

    // A fresh database per test, on the one container: the isolation between
    // sessions is one of the things under test, so no test may inherit
    // another's rows. `MigrateAsync` creates a database that does not exist yet.
    public async ValueTask InitializeAsync()
    {
        var connection = new NpgsqlConnectionStringBuilder(postgres.Container.GetConnectionString())
        {
            Database = $"test_{Guid.NewGuid():N}",
        };
        db = new AccountsDb(new DbContextOptionsBuilder<AccountsDb>().UseNpgsql(connection.ConnectionString).Options);
        await db.Database.MigrateAsync();
    }

    public async ValueTask DisposeAsync() => await db.DisposeAsync();

    [Fact]
    public async Task FindAccount_resolves_null_for_a_session_that_has_no_account()
    {
        // Act
        var found = await Store.FindAccount(db, "unknown");
        // Assert
        Assert.Null(found);
    }

    [Fact]
    public async Task FindAccount_returns_what_SaveAccount_stored_for_that_session_without_the_session()
    {
        // Arrange
        await Store.SaveAccount(db, "s1", account);
        // Act
        var found = await Store.FindAccount(db, "s1");
        // Assert
        Assert.Equal(account, found);
    }

    [Fact]
    public async Task FindAccount_does_not_see_another_sessions_account()
    {
        // Arrange
        await Store.SaveAccount(db, "s1", account);
        // Act
        var found = await Store.FindAccount(db, "s2");
        // Assert
        Assert.Null(found);
    }

    [Fact]
    public async Task SaveAccount_replaces_the_account_already_stored_for_the_session()
    {
        // Arrange
        await Store.SaveAccount(db, "s1", account);
        var replacement = account with { Id = "acc_2", Email = "other@example.com" };
        // Act
        await Store.SaveAccount(db, "s1", replacement);
        // Assert
        Assert.Equal(replacement, await Store.FindAccount(db, "s1"));
    }

    [Fact]
    public async Task UpdateAccount_replaces_every_field_but_keeps_the_server_owned_id()
    {
        // Arrange
        await Store.SaveAccount(db, "s1", account);
        // Act
        var updated = await Store.UpdateAccount(db, "s1", payload);
        // Assert
        var expected = new Account(account.Id, payload.Nom, payload.Prenom, payload.Email, payload.Telephone, payload.Langue, payload.Bio);
        Assert.Equal(expected, updated);
        Assert.Equal(expected, await Store.FindAccount(db, "s1"));
    }

    [Fact]
    public async Task UpdateAccount_resolves_null_and_stores_nothing_for_a_session_that_has_no_account()
    {
        // Act
        var updated = await Store.UpdateAccount(db, "missing", payload);
        // Assert
        Assert.Null(updated);
        Assert.Null(await Store.FindAccount(db, "missing"));
    }
}
